/**
 * MouseStalker
 * 高パフォーマンスなマウスストーカーライブラリ
 *
 * @example
 * // 1. 基本的な使い方（data属性のある要素上だけ表示）
 * // HTML: <a href="#" data-mouse-stalker="VIEW">Link</a>
 * new MouseStalker();
 *
 * // 2. 常に表示し、ホバーでテキスト変更
 * new MouseStalker({
 *   alwaysVisible: true,
 *   defaultText: 'SCROLL',
 *   style: {
 *     backgroundColor: 'red',
 *     mixBlendMode: 'difference'
 *   }
 * });
 *
 * @class MouseStalker
 * @param {Object} options - 設定オプション
 * @param {string} [options.selector='[data-mouse-stalker]'] - ホバー時に反応する要素のセレクタ
 * @param {string} [options.stalkerClass='js-mouseStalker'] - ストーカー要素のクラス名
 * @param {string} [options.textClass='js-mouseStalker__text'] - テキスト要素のクラス名
 * @param {string} [options.defaultText=''] - デフォルトのテキスト（data属性がない場合に使用）
 * @param {boolean} [options.alwaysVisible=false] - 常に表示するか（trueの場合、ホバー時以外も表示）
 * @param {number} [options.ease=0.18] - 追従の遅延係数 (0.01〜1.0)
 * @param {number} [options.minSpeed=0.1] - アニメーション停止判定の閾値
 * @param {number} [options.zIndex=9999] - ストーカーのz-index
 * @param {boolean} [options.pointerEventsNone=true] - pointer-events: none を適用するか
 * @param {Object} [options.style={}] - ストーカー要素への追加スタイル
 */
class MouseStalker {
  constructor(options = {}) {
    // デフォルト設定とマージ
    this.config = {
      selector: '[data-mouse-stalker]',
      stalkerClass: 'c-mouse-stalker',
      textClass: 'c-mouse-stalker__text',
      defaultText: '',
      alwaysVisible: false,
      ease: 0.18,
      minSpeed: 0.1,
      zIndex: 9999,
      pointerEventsNone: true,
      style: {},
      ...options,
    };

    // SSR環境や非ブラウザ環境でのガード
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    // ユーザーの「動きを減らす」設定を尊重
    this.prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (this.prefersReducedMotion) {
      return;
    }

    // ポインティングデバイスの精度チェック（タッチデバイス除外など）
    this.pointerFine = window.matchMedia('(pointer: fine)').matches;
    if (!this.pointerFine) {
      return;
    }

    // 状態管理
    this.isEnabled = false;
    this.container = null;
    this.textEl = null;
    this.activeTarget = null;
    this.currentText = '';

    // 座標管理（Float32Arrayでメモリ効率化）
    this.pos = new Float32Array([
      window.innerWidth / 2,
      window.innerHeight / 2,
    ]); // x, y
    this.target = new Float32Array([
      window.innerWidth / 2,
      window.innerHeight / 2,
    ]); // x, y

    this.isVisible = false;
    this.rafId = null;
    this.isMoving = false;
    this.textTimer = null; // テキスト切り替え用タイマー

    // バインド
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerOver = this.handlePointerOver.bind(this);
    this.handlePointerOut = this.handlePointerOut.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.update = this.update.bind(this);

    this.init();
  }

  /**
   * 初期化処理
   */
  init() {
    if (this.isEnabled) return;
    this.createStalker();
    this.bindEvents();
    this.isEnabled = true;
    this.render();
  }

  /**
   * DOM要素の生成
   */
  createStalker() {
    // 既存の要素があれば削除（再初期化時など）
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = document.createElement('div');
    this.container.className = this.config.stalkerClass;
    this.container.setAttribute('aria-hidden', 'true');

    // 基本スタイル + GPU最適化
    const baseStyle = {
      position: 'fixed',
      top: '0',
      left: '0',
      zIndex: this.config.zIndex,
      pointerEvents: this.config.pointerEventsNone ? 'none' : 'auto',
      willChange: 'transform',
      backfaceVisibility: 'hidden',
      transform: `translate3d(${this.pos[0]}px, ${this.pos[1]}px, 0)`,
      opacity: '0', // 初期状態は非表示
      transition: 'opacity 0.3s ease, visibility 0s linear 0.3s', // フェードイン・アウト用
      visibility: 'hidden', // 完全に隠す
    };

    // 常に表示モードの場合は初期状態を変更
    if (this.config.alwaysVisible) {
      baseStyle.opacity = '1';
      baseStyle.visibility = 'visible';
    }

    Object.assign(this.container.style, baseStyle, this.config.style);

    this.textEl = document.createElement('span');
    this.textEl.className = this.config.textClass;
    this.textEl.style.transition = 'opacity 0.3s ease'; // テキストのフェード用
    this.textEl.style.opacity = '0'; // テキストは初期非表示

    // alwaysVisibleかつdefaultTextがある場合は初期表示
    if (this.config.alwaysVisible && this.config.defaultText) {
      this.currentText = this.config.defaultText;
      this.textEl.textContent = this.config.defaultText;
      this.container.classList.add('has-text');
      this.textEl.style.opacity = '1';
    }

    this.container.appendChild(this.textEl);
    document.body.appendChild(this.container);
  }

  /**
   * イベントリスナーの登録
   */
  bindEvents() {
    document.addEventListener('pointermove', this.handlePointerMove, {
      passive: true,
    });
    document.addEventListener('pointerover', this.handlePointerOver, true);
    document.addEventListener('pointerout', this.handlePointerOut, true);
    document.addEventListener('pointerleave', this.handlePointerLeave);
    window.addEventListener('blur', this.handleWindowBlur);
  }

  /**
   * イベントリスナーの解除
   */
  unbindEvents() {
    document.removeEventListener('pointermove', this.handlePointerMove);
    document.removeEventListener('pointerover', this.handlePointerOver, true);
    document.removeEventListener('pointerout', this.handlePointerOut, true);
    document.removeEventListener('pointerleave', this.handlePointerLeave);
    window.removeEventListener('blur', this.handleWindowBlur);
  }

  handlePointerMove(event) {
    this.target[0] = event.clientX;
    this.target[1] = event.clientY;

    // 最初の動きで表示開始（alwaysVisibleの場合）
    if (!this.isVisible && this.isEnabled && this.config.alwaysVisible) {
      this.isVisible = true;
      this.container.style.transition = 'opacity 0.3s ease, visibility 0s';
      this.container.style.visibility = 'visible';
      this.container.style.opacity = '1';
    }

    if (!this.isMoving) {
      this.isMoving = true;
      this.rafId = requestAnimationFrame(this.update);
    }
  }

  handlePointerOver(event) {
    const target = event.target.closest(this.config.selector);
    if (!target || this.activeTarget === target) return;

    this.activeTarget = target;

    // テキスト設定（data属性 > デフォルトテキスト）
    const text = target.dataset.mouseStalker || this.config.defaultText;

    // ホバー時のクラス付与
    this.container.classList.add('is-hover');

    // 表示切り替え
    if (!this.isVisible) {
      this.isVisible = true;
      this.container.style.transition = 'opacity 0.3s ease, visibility 0s';
      this.container.style.visibility = 'visible';
      this.container.style.opacity = '1';

      // タイマーがあればキャンセル
      if (this.textTimer) {
        clearTimeout(this.textTimer);
        this.textTimer = null;
      }

      // ストーカーが表示されるのと同時にテキストもセット（フェードなしで即時反映）
      this.currentText = text;
      this.textEl.textContent = text;
      this.container.classList.toggle('has-text', Boolean(text));
      this.textEl.style.opacity = text ? '1' : '0';
    } else {
      // すでに表示されている場合は通常通りフェード切り替え
      this.setText(text);
    }
  }

  handlePointerOut(event) {
    if (!this.activeTarget) return;

    // 子要素への移動なら無視
    const related = event.relatedTarget;
    if (related && this.activeTarget.contains(related)) return;

    this.clearMouseStalker();
  }

  handlePointerLeave() {
    if (this.config.alwaysVisible) return; // 常に表示なら隠さない

    this.isVisible = false;
    this.container.style.transition = 'opacity 0.3s ease, visibility 0s linear 0.3s';
    this.container.style.opacity = '0';
    this.container.style.visibility = 'hidden';
  }

  handleWindowBlur() {
    if (this.config.alwaysVisible) return; // 常に表示なら隠さない

    this.isVisible = false;
    this.container.style.transition = 'opacity 0.3s ease, visibility 0s linear 0.3s';
    this.container.style.opacity = '0';
    this.container.style.visibility = 'hidden';
  }

  setText(text) {
    // タイマーがあればキャンセル
    if (this.textTimer) {
      clearTimeout(this.textTimer);
      this.textTimer = null;
    }

    // テキストが変わらない場合
    if (this.currentText === text) {
      // すでに表示されているなら何もしない（opacityが1であることを保証）
      if (text) {
        this.textEl.style.opacity = '1';
        this.container.classList.add('has-text');
      }
      return;
    }

    // フェードアウトしてからテキスト変更
    this.textEl.style.opacity = '0';

    this.textTimer = setTimeout(() => {
      this.currentText = text;
      this.textEl.textContent = text;
      this.container.classList.toggle('has-text', Boolean(text));

      // テキストがある場合のみフェードイン
      if (text) {
        this.textEl.style.opacity = '1';
      }
      this.textTimer = null;
    }, 200); // CSSのtransition時間と合わせる
  }

  clearText() {
    // タイマーがあればキャンセル
    if (this.textTimer) {
      clearTimeout(this.textTimer);
      this.textTimer = null;
    }

    if (!this.currentText) return;

    this.textEl.style.opacity = '0';

    this.textTimer = setTimeout(() => {
      this.currentText = '';
      this.textEl.textContent = '';
      this.container.classList.remove('has-text');
      this.textTimer = null;
    }, 200);
  }

  clearMouseStalker() {
    this.activeTarget = null;

    if (this.config.alwaysVisible && this.config.defaultText) {
      // デフォルトテキストに戻す
      this.setText(this.config.defaultText);
    } else {
      // テキストを消す
      this.clearText();
    }

    // alwaysVisibleでない場合は隠す
    if (!this.config.alwaysVisible) {
      this.isVisible = false;
      this.container.style.transition =
        'opacity 0.3s ease, visibility 0s linear 0.3s';
      this.container.style.opacity = '0';
      this.container.style.visibility = 'hidden';

      // フェードアウトに合わせてクラス削除を遅延
      setTimeout(() => {
        if (!this.isVisible && !this.activeTarget) {
          this.container.classList.remove('is-hover');
        }
      }, 300);
    } else {
      this.container.classList.remove('is-hover');
    }
  }

  render() {
    this.rafId = requestAnimationFrame(this.update);
  }

  update() {
    if (!this.isEnabled) return;

    const dx = this.target[0] - this.pos[0];
    const dy = this.target[1] - this.pos[1];

    // 動きが止まったらループ停止（省電力）
    if (
      Math.abs(dx) < this.config.minSpeed &&
      Math.abs(dy) < this.config.minSpeed
    ) {
      this.pos[0] = this.target[0];
      this.pos[1] = this.target[1];
      this.container.style.transform = `translate3d(${this.pos[0]}px, ${this.pos[1]}px, 0)`;
      this.isMoving = false;
      return;
    }

    this.pos[0] += dx * this.config.ease;
    this.pos[1] += dy * this.config.ease;

    // 小数点以下を丸めてGPU負荷軽減
    const x = ((this.pos[0] * 100) | 0) / 100;
    const y = ((this.pos[1] * 100) | 0) / 100;

    this.container.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    this.rafId = requestAnimationFrame(this.update);
  }

  /**
   * ストーカー機能を一時停止
   */
  disable() {
    this.isEnabled = false;
    this.container.style.display = 'none';
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  /**
   * ストーカー機能を再開
   */
  enable() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    this.container.style.display = 'block';
    this.pos[0] = this.target[0]; // 位置飛び防止
    this.pos[1] = this.target[1];
    this.render();
  }

  /**
   * インスタンスの破棄
   */
  destroy() {
    this.isEnabled = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.textTimer) clearTimeout(this.textTimer);
    this.unbindEvents();

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
    this.textEl = null;
  }
}

export default MouseStalker;
