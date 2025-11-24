
export default class Accordion {
    /**
     * @param {string} selector - The selector for the accordion container(s).
     * @param {object} options - Configuration options.
     * @param {boolean} options.shouldOpenAll - If true, multiple items can be open at once. Default is false.
     * @param {string} options.triggerSelector - Selector for the trigger element within an item.
     * @param {string} options.contentSelector - Selector for the content element within an item.
     * @param {string} options.itemSelector - Selector for the individual accordion items.
     * @param {string} options.activeClass - Class to apply to the active item.
     */
    constructor(selector, options = {}) {
        this.containers = document.querySelectorAll(selector);
        this.options = {
            shouldOpenAll: false,
            triggerSelector: '.js-accordion-trigger',
            contentSelector: '.js-accordion-content',
            itemSelector: '.js-accordion-item',
            activeClass: 'is-active',
            ...options
        };

        if (this.containers.length === 0) {
            console.warn(`Accordion: No elements found for selector "${selector}"`);
            return;
        }

        this.init();
    }

    init() {
        this.containers.forEach(container => {
            const items = container.querySelectorAll(this.options.itemSelector);

            items.forEach(item => {
                const trigger = item.querySelector(this.options.triggerSelector);

                if (trigger) {
                    trigger.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.toggle(item, items);
                    });
                }
            });
        });
    }

    /**
     * Toggles the state of an accordion item.
     * @param {HTMLElement} item - The item to toggle.
     * @param {NodeList} allItems - All items in the current container (used for closing others).
     */
    toggle(item, allItems) {
        const isActive = item.classList.contains(this.options.activeClass);

        // If not allowing multiple open, close all others
        if (!this.options.shouldOpenAll && !isActive) {
            allItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove(this.options.activeClass);
                    this.close(otherItem);
                }
            });
        }

        // Toggle the clicked item
        if (isActive) {
            item.classList.remove(this.options.activeClass);
            this.close(item);
        } else {
            item.classList.add(this.options.activeClass);
            this.open(item);
        }
    }

    open(item) {
        const content = item.querySelector(this.options.contentSelector);
        if (content) {
            content.setAttribute('aria-hidden', 'false');
        }
    }

    close(item) {
        const content = item.querySelector(this.options.contentSelector);
        if (content) {
            content.setAttribute('aria-hidden', 'true');
        }
    }
}
