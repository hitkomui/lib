import LoopSlider from './classes/LoopSlider.js';
import MouseStalker from './classes/MouseStalker.js';
import ScrollProgressAnimation from './classes/ScrollProgressAnimation.js';
import TextReveal from './classes/TextReveal.js';

export default function main() {
    console.log('JS Start!!');
    // Loop Slider
    new LoopSlider('.js-loop-slider1', {
        speed: 50,
        gap: 20,
        effect: "scroll",
        inertia: 0.95,
				reverse: true
    });

    new LoopSlider('.js-loop-slider2', {
        speed: 50,
        gap: 20,
        effect: "draggable",
        inertia: 0.95,
				reverse: false
    });

    // Mouse Stalker
    new MouseStalker({
        alwaysVisible: false,
        selector: '[data-mouse-stalker]'
    });

    // Scroll Progress
    new ScrollProgressAnimation({
        containerSelector: '.js-scroll-container',
        progressSelector: '.js-scroll-progress-line',
        itemSelector: '[data-scroll-item]',
        triggerPosition: '60%',
        onItemActive: (item) => {
            item.classList.add('is-active');
            if (item.classList.contains('c-scroll-dot')) {
                item.closest('.c-scroll-item')?.classList.add('is-active');
            }
        },
        onItemInactive: (item) => {
            item.classList.remove('is-active');
            if (item.classList.contains('c-scroll-dot')) {
                item.closest('.c-scroll-item')?.classList.remove('is-active');
            }
        }
    }).init();

    // Text Reveal
    new TextReveal('h3', {
        effect: 'fade',
        once: false, // 何度でも繰り返す,
				rootMargin: '0px 0px -50% 0px',
    });

    new TextReveal('h2', {
        effect: 'slide',
        once: false,
				rootMargin: '0px 0px -50% 0px',
    });
};

main();