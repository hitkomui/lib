/**
 * LoopSlider
 * 無限ループする画像スライダー
 * ・常に右から左へゆっくり移動
 * ・ドラッグ操作可能（ネイティブ実装、オプションで無効化可）
 * ・ドラッグ後は自動アニメーションに復帰
 * ・GSAP非依存
 * ・gapはJS指定またはCSS指定が可能
 * ・逆方向スライド、スクロール連動速度変化に対応
 *
 * @example
 * new LoopSlider('.js-loop-image', {
 *   speed: 50,
 *   gap: null,
 *   reverse: false, // trueで左から右へ移動
 *   effect: 'draggable', // 'draggable' or 'scroll'
 *   scrollSpeed: 0.5, // スクロール連動時の感度
 *   draggable: true,
 *   inertia: 0.95
 * });
 */
class LoopSlider {
  constructor(selector, options = {}) {
    this.container =
      typeof selector === 'string'
        ? document.querySelector(selector)
        : selector;
    if (!this.container) return;

    // コンテナ直下の子要素をスライドとして取得
    this.slides = Array.from(this.container.children);
    if (this.slides.length === 0) return;

    this.options = {
      speed: 50, // px/秒
      gap: null, // スライド間の余白 (nullの場合はCSSで指定)
      reverse: false, // 逆方向（左から右）
      effect: 'draggable', // 'draggable' | 'scroll'
      scrollSpeed: 0.5, // スクロール連動の強さ
      draggable: true, // ドラッグ操作の有効/無効 (effect: 'scroll'時は無視される)
      inertia: 0.95, // 慣性の強さ (0〜1)
      ...options,
    };

    // effectがscrollの場合はdraggableを強制無効
    if (this.options.effect === 'scroll') {
      this.options.draggable = false;
    }

    this.baseX = 0; // アニメーションのベース位置
    this.dragX = 0; // ドラッグのオフセット
    this.isDragging = false;
    this.startX = 0;
    this.currentX = 0;
    this.animation = null;
    this.wrapper = null;
    this.resizeTimeout = null;

    // スクロール連動用
    this.smoothedScrollY = window.scrollY;
    this.lastSmoothedScrollY = window.scrollY;

    // ドラッグ慣性用
    this.velocity = 0;
    this.lastDragX = 0;
    this.lastTime = 0;

    // イベントハンドラのバインド（削除用）
    this.handleResize = this.handleResize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.init();
  }

  init() {
    this.setupSlider();
    this.startAutoScroll();
    this.setupDraggable();
    this.setupResize();
  }

  setupSlider() {
    // ラッパー要素を作成
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'c-loop-slider__wrapper';

    // オリジナルのスライドをラッパーに移動
    this.slides.forEach((slide) => {
      this.wrapper.appendChild(slide);
    });

    // クローンを3セット作成して無限ループを確実に
    for (let i = 0; i < 3; i++) {
      const clones = this.slides.map((slide) => slide.cloneNode(true));
      clones.forEach((clone) => {
        this.wrapper.appendChild(clone);
      });
    }

    this.container.appendChild(this.wrapper);

    // ラッパーを絶対配置
    const wrapperStyle = {
      position: 'absolute',
      left: '0',
      top: '0',
      display: 'flex',
      willChange: 'transform',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
      perspective: '1000px',
      WebkitPerspective: '1000px',
      transformStyle: 'preserve-3d',
      WebkitTransformStyle: 'preserve-3d',
    };

    if (typeof this.options.gap === 'number') {
      wrapperStyle.gap = `${this.options.gap}px`;
    }

    Object.assign(this.wrapper.style, wrapperStyle);

    // 各スライドの設定
    const allSlides = Array.from(this.wrapper.children);
    allSlides.forEach((slide) => {
      slide.style.flexShrink = '0';
      slide.style.backfaceVisibility = 'hidden';
      slide.style.WebkitBackfaceVisibility = 'hidden';
      slide.style.transform = 'translateZ(0)';
    });

    this.updateDimensions();
  }

  getGap() {
    if (typeof this.options.gap === 'number') {
      return this.options.gap;
    }
    const computedStyle = getComputedStyle(this.wrapper);
    const gapStr = computedStyle.gap || computedStyle.columnGap || '0px';
    return parseFloat(gapStr) || 0;
  }

  updateDimensions() {
    // スライド幅を再計算
    const gap = this.getGap();
    this.slideWidth = this.slides[0].offsetWidth + gap;
    this.totalWidth = this.slideWidth * this.slides.length;

    // 現在の位置を維持しながら比率を調整
    if (this.totalWidth > 0) {
      const progress = this.baseX / this.totalWidth;
      this.baseX = progress * this.totalWidth;
    }
  }

  setupResize() {
    window.addEventListener('resize', this.handleResize, { passive: true });
  }

  handleResize() {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    this.resizeTimeout = setTimeout(() => {
      this.updateDimensions();
    }, 150);
  }

  startAutoScroll() {
    let lastFrameTime = null;
    const direction = this.options.reverse ? -1 : 1;

    const updatePosition = (timestamp) => {
      if (!timestamp) timestamp = performance.now();
      if (!lastFrameTime) {
        lastFrameTime = timestamp;
        this.animation = requestAnimationFrame(updatePosition);
        return;
      }

      const deltaTime = (timestamp - lastFrameTime) / 1000; // 秒単位
      lastFrameTime = timestamp;

      // タブ切り替え等で時間が飛びすぎた場合は補正（最大0.1秒分まで）
      const dt = deltaTime > 0.1 ? 0.1 : deltaTime;

      // スクロール連動の計算
      let scrollMove = 0;
      if (this.options.effect === 'scroll') {
        const currentScrollY = window.scrollY;
        // Lerpで滑らかに追従
        this.smoothedScrollY += (currentScrollY - this.smoothedScrollY) * 0.1;
        const diff = this.smoothedScrollY - this.lastSmoothedScrollY;
        this.lastSmoothedScrollY = this.smoothedScrollY;

        scrollMove = diff * this.options.scrollSpeed;
      }

      // 1. 自動スクロール + スクロール連動
      if (!this.isDragging) {
        let move = this.options.speed * dt;

        // スクロール連動加算
        if (this.options.effect === 'scroll') {
          move += scrollMove;
        }

        // 方向適用
        this.baseX -= move * direction;
      }

      // 2. 慣性スクロール（自前計算）
      if (!this.isDragging && Math.abs(this.velocity) > 10) {
        // 慣性移動
        this.dragX += this.velocity * dt;

        // 減衰
        const friction = this.options.inertia;
        const timeAdjustedFriction = Math.pow(friction, dt * 60);
        this.velocity *= timeAdjustedFriction;
      } else if (!this.isDragging && this.dragX !== 0) {
        // 慣性が収束したらbaseXに吸収
        this.baseX += this.dragX;
        this.dragX = 0;
        this.velocity = 0;
      }

      // 現在のトータル位置
      const currentX = this.baseX + this.dragX;

      // ループ範囲判定と補正
      // baseXは常に負の領域(-totalWidth付近)で管理する
      const loopMin = -this.totalWidth * 2;
      const loopMax = -this.totalWidth;

      if (currentX < loopMin) {
        // 左に行き過ぎた場合（通常進行）
        const diff = loopMin - currentX;
        const count = Math.ceil(diff / this.totalWidth);
        this.baseX += this.totalWidth * count;
      } else if (currentX > loopMax) {
        // 右に行き過ぎた場合（逆進行 or ドラッグ戻り）
        const diff = currentX - loopMax;
        const count = Math.ceil(diff / this.totalWidth);
        this.baseX -= this.totalWidth * count;
      }

      // 描画更新
      const finalX = this.baseX + this.dragX;
      // 小数点以下を制限してGPU負荷を軽減
      this.wrapper.style.transform = `translate3d(${finalX.toFixed(2)}px, 0, 0)`;

      this.animation = requestAnimationFrame(updatePosition);
    };

    // 初期位置設定
    this.baseX = -this.totalWidth;
    this.animation = requestAnimationFrame(updatePosition);
  }

  setupDraggable() {
    if (!this.options.draggable) {
      this.container.style.cursor = '';
      return;
    }

    this.container.style.cursor = 'grab';
    this.container.addEventListener('mousedown', this.onPointerDown);
    this.container.addEventListener('touchstart', this.onPointerDown, {
      passive: true,
    });

    document.addEventListener('mousemove', this.onPointerMove);
    document.addEventListener('touchmove', this.onPointerMove, {
      passive: true,
    });

    document.addEventListener('mouseup', this.onPointerUp);
    document.addEventListener('touchend', this.onPointerUp);
  }

  onPointerDown(e) {
    // マウス操作時のネイティブドラッグ（画像保存など）を無効化
    if (e.type === 'mousedown') {
      e.preventDefault();
    }

    this.isDragging = true;
    this.startX = e.touches ? e.touches[0].clientX : e.clientX;
    this.startDragX = this.dragX;

    this.velocity = 0;
    this.lastDragX = this.dragX;
    this.lastTime = performance.now();

    this.container.style.cursor = 'grabbing';
  }

  onPointerMove(e) {
    if (!this.isDragging) return;

    this.currentX = e.touches ? e.touches[0].clientX : e.clientX;
    const diff = this.currentX - this.startX;
    this.dragX = this.startDragX + diff;

    // 速度計算
    const now = performance.now();
    const deltaTime = now - this.lastTime;
    if (deltaTime > 0) {
      const v = ((this.dragX - this.lastDragX) / deltaTime) * 1000;
      this.velocity = this.velocity * 0.2 + v * 0.8;
    }

    this.lastDragX = this.dragX;
    this.lastTime = now;
  }

  onPointerUp() {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.container.style.cursor = 'grab';
  }

  destroy() {
    if (this.animation) {
      cancelAnimationFrame(this.animation);
    }
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    window.removeEventListener('resize', this.handleResize);

    this.container.removeEventListener('mousedown', this.onPointerDown);
    this.container.removeEventListener('touchstart', this.onPointerDown);

    document.removeEventListener('mousemove', this.onPointerMove);
    document.removeEventListener('touchmove', this.onPointerMove);

    document.removeEventListener('mouseup', this.onPointerUp);
    document.removeEventListener('touchend', this.onPointerUp);
  }
}
export default LoopSlider;
