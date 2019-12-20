
import {
  outerHeight,
  outerWidth,
  setOverlayPosition,
  resetCssTransform
} from './../../../../helpers/dom/element';
import TopLeftCornerOverlayTable from './../table/topLeftCorner';
import Overlay from './_base';

/**
 * @class TopLeftCornerOverlay
 */
class TopLeftCornerOverlay extends Overlay {
  /**
   * @param {Walkontable} wotInstance
   */
  constructor(wotInstance) {
    super(wotInstance);
    this.clone = this.makeClone(Overlay.CLONE_TOP_LEFT_CORNER);
  }

  /**
   * Factory method to create a subclass of `Table` that is relevant to this overlay.
   *
   * @see Table#constructor
   * @param {...*} args Parameters that will be forwarded to the `Table` constructor
   * @returns {Table}
   */
  createTable(...args) {
    return new TopLeftCornerOverlayTable(...args);
  }

  /**
   * Checks if overlay should be fully rendered
   *
   * @returns {Boolean}
   */
  shouldBeRendered() {
    const { master } = this;
    return !!((master.getSetting('fixedRowsTop') || master.getSetting('columnHeaders').length) &&
        (master.getSetting('fixedColumnsLeft') || master.getSetting('rowHeaders').length));
  }

  /**
   * Updates the corner overlay position
   */
  resetFixedPosition() {
    this.updateTrimmingContainer();

    if (!this.master.wtTable.holder.parentNode) {
      // removed from DOM
      return;
    }
    const overlayRoot = this.clone.wtTable.holder.parentNode;
    const preventOverflow = this.master.getSetting('preventOverflow');

    if (this.trimmingContainer === this.master.rootWindow) {
      const box = this.master.wtTable.hider.getBoundingClientRect();
      const top = Math.ceil(box.top);
      const left = Math.ceil(box.left);
      const bottom = Math.ceil(box.bottom);
      const right = Math.ceil(box.right);
      let finalLeft = '0';
      let finalTop = '0';

      if (!preventOverflow || preventOverflow === 'vertical') {
        if (left < 0 && (right - overlayRoot.offsetWidth) > 0) {
          finalLeft = `${-left}px`;
        }
      }

      if (!preventOverflow || preventOverflow === 'horizontal') {
        if (top < 0 && (bottom - overlayRoot.offsetHeight) > 0) {
          finalTop = `${-top}px`;
        }
      }
      setOverlayPosition(overlayRoot, finalLeft, finalTop);
    } else {
      resetCssTransform(overlayRoot);
    }

    let tableHeight = outerHeight(this.clone.wtTable.TABLE);
    const tableWidth = outerWidth(this.clone.wtTable.TABLE);

    if (!this.master.wtTable.hasDefinedSize()) {
      tableHeight = 0;
    }

    overlayRoot.style.height = `${tableHeight}px`;
    overlayRoot.style.width = `${tableWidth}px`;
  }
}

Overlay.registerOverlay(Overlay.CLONE_TOP_LEFT_CORNER, TopLeftCornerOverlay);

export default TopLeftCornerOverlay;
