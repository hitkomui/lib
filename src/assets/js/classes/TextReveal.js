/**
 * TextReveal
 * テキストを一文字ずつ出現させるアニメーション
 *
 * Features:
 * - IntersectionObserverによる高パフォーマンスなスクロール検知
 * - DocumentFragmentを使用したDOM操作の最適化
 * - 複数行・ネストされたタグ・改行(<br>)のサポート
 * - アクセシビリティ対応 (aria-label)
 * - 柔軟なオプション設定 (エフェクト、遅延、リセット制御)
 */
export default class TextReveal {
  /**
   * @param {string} selector - 対象要素のセレクタ
   * @param {Object} options - 設定オプション
   */
  constructor(selector = '.js-text-reveal', options = {}) {
    this.elements = document.querySelectorAll(selector);
    
    // 要素が存在しない場合は早期リターン
    if (this.elements.length === 0) return;

    this.options = {
      root: null,
      rootMargin: '0px 0px -50% 0px', // 画面中央で発火
      threshold: 0,
      duration: 0.6, // アニメーション時間(秒)
      stagger: 0.03, // 文字間の遅延(秒)
      once: false, // true: 一度のみ再生
      resetOnScrollUp: false, // false: 上スクロールで画面外に出てもリセットしない
      effect: 'fade', // 'fade' | 'slide'
      ...options,
    };

    // バインド
    this.handleIntersect = this.handleIntersect.bind(this);

    // IntersectionObserverの初期化
    this.observer = new IntersectionObserver(
      this.handleIntersect,
      {
        root: this.options.root,
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold,
      }
    );

    this.init();
  }

  init() {
    // DocumentFragmentは使えない（各要素が離れているため）、ループ内で処理
    this.elements.forEach((el) => {
      // 初期化済みフラグのチェック（二重適用防止）
      if (el.dataset.textRevealInitialized) return;
      el.dataset.textRevealInitialized = 'true';

      this.setupElement(el);
      this.splitText(el);
      this.observer.observe(el);
    });
  }

  /**
   * 要素の初期設定（クラス付与、ARIA属性）
   * @param {HTMLElement} el
   */
  setupElement(el) {
    // 必須クラスの付与
    if (!el.classList.contains('js-text-reveal') && !el.classList.contains('js-text-reveal-slide')) {
      el.classList.add('js-text-reveal');
    }

    // エフェクトクラスの付与
    el.classList.add(`js-text-reveal-effect-${this.options.effect}`);

    // アクセシビリティ: 元のテキストを保持し、スクリーンリーダーに読み上げさせる
    // 分割後のspanはCSS等で読み上げから除外される場合があるため、親にaria-labelを設定
    const originalText = el.textContent.trim();
    if (!el.getAttribute('aria-label')) {
      el.setAttribute('aria-label', originalText);
    }
  }

  /**
   * テキストを文字単位に分割してDOMを再構築
   * DocumentFragmentを使用してリフローを最小限に抑える
   * @param {HTMLElement} el
   */
  splitText(el) {
    const fragment = document.createDocumentFragment();
    const nodes = Array.from(el.childNodes);
    let charIndex = 0;

    nodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        
        // 空白のみのテキストノードはそのまま維持（レイアウト崩れ防止）
        if (!text.trim()) {
          fragment.appendChild(document.createTextNode(text));
          return;
        }

        // 文字ごとに分割
        const chars = text.split('');
        chars.forEach((char) => {
          const span = this.createCharSpan(char, charIndex);
          
          // slideエフェクト用のラッパー処理
          if (this.options.effect === 'slide') {
            const wrapper = document.createElement('span');
            wrapper.className = 'js-text-reveal-wrapper';
            
            // 空白文字の特別処理
            if (char === ' ') {
              wrapper.style.display = 'inline';
            }
            
            wrapper.appendChild(span);
            fragment.appendChild(wrapper);
          } else {
            fragment.appendChild(span);
          }

          charIndex++;
        });
      } else {
        // 要素ノード（<br>や<strong>など）はクローンして維持
        // 再帰的に処理することも可能だが、今回は浅い階層のみサポート
        fragment.appendChild(node.cloneNode(true));
      }
    });

    // DOMの一括更新
    el.innerHTML = '';
    el.appendChild(fragment);
  }

  /**
   * 文字用のspan要素を作成
   * @param {string} char - 文字
   * @param {number} index - インデックス
   * @returns {HTMLSpanElement}
   */
  createCharSpan(char, index) {
    const span = document.createElement('span');
    span.textContent = char;
    span.className = 'js-text-reveal-char';
    
    // インラインスタイルで遅延を設定（CSS変数の方が望ましいが、互換性重視でstyle属性）
    // パフォーマンス向上のため、will-changeはCSS側で制御
    span.style.transitionDuration = `${this.options.duration}s`;
    span.style.transitionDelay = `${index * this.options.stagger}s`;
    
    // スクリーンリーダー対策: 分割された文字は装飾扱いにする
    span.setAttribute('aria-hidden', 'true');

    if (char === ' ') {
      span.innerHTML = '&nbsp;';
    }

    return span;
  }

  /**
   * IntersectionObserverのコールバック
   * @param {IntersectionObserverEntry[]} entries
   */
  handleIntersect(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        this.animateIn(entry.target);
      } else {
        this.animateOut(entry);
      }
    });
  }

  /**
   * アニメーション開始（表示）
   * @param {HTMLElement} target
   */
  animateIn(target) {
    if (target.classList.contains('is-inview')) return;
    
    target.classList.add('is-inview');

    if (this.options.once) {
      this.observer.unobserve(target);
    }
  }

  /**
   * アニメーションリセット（非表示）
   * @param {IntersectionObserverEntry} entry
   */
  animateOut(entry) {
    if (this.options.once) return;
    if (!entry.target.classList.contains('is-inview')) return;

    // 上スクロール時のリセット制御
    // boundingClientRect.top < 0 は要素がビューポートより上にある状態
    if (!this.options.resetOnScrollUp && entry.boundingClientRect.top < 0) {
      return;
    }

    entry.target.classList.remove('is-inview');
  }

  /**
   * インスタンスの破棄
   */
  destroy() {
    this.observer.disconnect();
    this.elements = null;
  }
}
