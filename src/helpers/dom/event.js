import { getWindowScrollTop, getWindowScrollLeft } from './element';

/**
 * Prevent other listeners of the same event from being called.
 *
 * @param {Event} event
 */
export function stopImmediatePropagation(event) {
  event.isImmediatePropagationEnabled = false;
  event.cancelBubble = true;
}

/**
 * Check if event was stopped by `stopImmediatePropagation`.
 *
 * @param event {Event}
 * @returns {Boolean}
 */
export function isImmediatePropagationStopped(event) {
  return event.isImmediatePropagationEnabled === false;
}

/**
 * Prevent further propagation of the current event (prevent bubbling).
 *
 * @param event {Event}
 */
export function stopPropagation(event) {
  // ie8
  // http://msdn.microsoft.com/en-us/library/ie/ff975462(v=vs.85).aspx
  if (typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  } else {
    event.cancelBubble = true;
  }
}

/**
 * Get horizontal coordinate of the event object relative to the whole document.
 *
 * @param {Event} event
 * @returns {Number}
 */
export function pageX(event) {
  if (event.pageX) {
    return event.pageX;
  }

  const rootWindow = event.target.ownerDocument.defaultView;

  return event.clientX + getWindowScrollLeft(rootWindow);
}

/**
 * Get vertical coordinate of the event object relative to the whole document.
 *
 * @param {Event} event
 * @returns {Number}
 */
export function pageY(event) {
  if (event.pageY) {
    return event.pageY;
  }

  const rootWindow = event.target.ownerDocument.defaultView;

  let frame = rootWindow;
  let offset = getWindowScrollTop(frame);

  while (Object.getPrototypeOf(frame.parent) && frame.frameElement) {
    frame = frame.frameElement.ownerDocument.defaultView;
    offset -= getWindowScrollTop(frame);
  }

  return event.clientY + offset;
}

/**
 * Check if provided event was triggered by clicking the right mouse button.
 *
 * @param {Event} event DOM Event.
 * @returns {Boolean}
 */
export function isRightClick(event) {
  return event.button === 2;
}

/**
 * Check if provided event was triggered by clicking the left mouse button.
 *
 * @param {Event} event DOM Event.
 * @returns {Boolean}
 */
export function isLeftClick(event) {
  return event.button === 0;
}
