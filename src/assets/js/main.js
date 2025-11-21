import LoopSlider from './classes/LoopSlider.js';
import MouseStalker from './classes/MouseStalker.js';
import ScrollProgressAnimation from './classes/ScrollProgressAnimation.js';

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

    // // Scroll Progress
    // new ScrollProgressAnimation({
    //     containerSelector: '.js-scroll-container',
    //     progressSelector: '.c-scroll-line__progress',
    //     itemSelector: '.c-scroll-item',
    //     triggerPosition: '60%',
    //     onItemActive: (item) => {
    //         item.classList.add('is-active');
    //     },
    //     onItemInactive: (item) => {
    //         item.classList.remove('is-active');
    //     }
    // }).init();
};

main();