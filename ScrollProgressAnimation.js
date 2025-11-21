import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * ScrollProgressAnimation
 * スクロールに応じて進捗線を伸ばし、各アイテムがトリガーポイントに達したときにコールバックを実行する汎用クラス
 * タイムライン・リスト・ステップなど様々な用途に対応
 *
 * @example
 * // 基本的な使い方
 * import ScrollProgressAnimation from './modules/TimelineAnimation.js';
 *
 * new ScrollProgressAnimation({
 *     containerSelector: '.js-timeline-container',
 *     progressSelector: '.js-timeline-progress',
 *     itemSelector: '[data-timeline-point]',
 *     triggerPosition: '60%',
 *     onItemActive: (item) => {
 *         item.classList.add('is-active');
 *         gsap.to(item, { backgroundColor: 'var(--cl-green)', duration: 0.4 });
 *     },
 *     onItemInactive: (item) => {
 *         item.classList.remove('is-active');
 *         gsap.to(item, { backgroundColor: 'rgba(255,255,255,0.3)', duration: 0.4 });
 *     }
 * }).init();
 *
 * @example
 * // HTMLの構造例
 * <div class="js-timeline-container"><!-- position:relative -->
 *     <div class="timeline__line"><!-- position:absolute -->
 *         <div class="timeline__progress js-timeline-progress"></div>
 *     </div>
 *
 *     <div class="timeline__list">
 *          <div class="timeline__item">
 *              <div class="timeline__dot" data-timeline-point></div>
 *              <p>2000年 会社設立</p>
 *           </div>
 *          <div class="timeline__item">
 *              <div class="timeline__dot" data-timeline-point></div>
 *              <p>2005年 事業拡大</p>
 *          </div>
 *     </div>
 * </div>
 *
 * @param {Object} options - 設定オプション
 * @param {string} options.containerSelector - コンテナのセレクタ（デフォルト: '.js-scroll-progress-container'）
 * @param {string} options.progressSelector - 進捗線のセレクタ（デフォルト: '.js-scroll-progress-line'）
 * @param {string} options.itemSelector - アイテムのセレクタ（デフォルト: '[data-scroll-item]'）
 * @param {string} options.triggerPosition - ScrollTriggerの発火位置（デフォルト: 'top 60%'）
 * @param {Function} options.onItemActive - アイテムがアクティブになった時のコールバック
 * @param {Function} options.onItemInactive - アイテムが非アクティブになった時のコールバック
 */
export default class ScrollProgressAnimation {
  constructor(options = {}) {
    this.config = {
      containerSelector: '.js-scroll-progress-container',
      progressSelector: '.js-scroll-progress-line',
      itemSelector: '[data-scroll-item]',
      start: `top ${options.triggerPosition ?? '60%'}`,
      end: `bottom ${options.triggerPosition ?? '60%'}`,
      onItemActive: null, // itemがactiveになった時のコールバック
      onItemInactive: null, // itemが非activeになった時のコールバック
      ...options,
    };

    this.container = document.querySelector(this.config.containerSelector);
    this.progress = document.querySelector(this.config.progressSelector);
    this.items = document.querySelectorAll(this.config.itemSelector);
    this.scrollTriggers = [];
  }

  init() {
    if (!this.isValid()) {
      return this;
    }

    this.animateProgress();
    this.animateItems();
    return this;
  }

  isValid() {
    return this.container && this.progress && this.items.length > 0;
  }

  animateProgress() {
    const trigger = ScrollTrigger.create({
      trigger: this.container,
      start: this.config.start,
      end: this.config.end,
      scrub: 1,
      animation: gsap.to(this.progress, {
        scaleY: 1,
        transformOrigin: 'top',
        ease: 'none',
      }),
    });

    this.scrollTriggers.push(trigger);
  }

  animateItems() {
    this.items.forEach((item) => {
      const trigger = ScrollTrigger.create({
        trigger: item,
        start: this.config.start,
        end: this.config.end,
        onEnter: () => {
          if (this.config.onItemActive) {
            this.config.onItemActive(item);
          }
        },
        onLeaveBack: () => {
          if (this.config.onItemInactive) {
            this.config.onItemInactive(item);
          }
        },
      });

      this.scrollTriggers.push(trigger);
    });
  }

  destroy() {
    this.scrollTriggers.forEach((trigger) => trigger.kill());
    this.scrollTriggers = [];
  }

  refresh() {
    ScrollTrigger.refresh();
  }
}
