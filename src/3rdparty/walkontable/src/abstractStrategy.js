/**
 * WalkontableAbstractStrategy (WalkontableColumnStrategy inherits from this)
 * @constructor
 */
function WalkontableAbstractStrategy(instance) {
  this.instance = instance;
}

WalkontableAbstractStrategy.prototype.getSize = function (index) {
  return this.cellSizes[index];
};

WalkontableAbstractStrategy.prototype.getContainerSize = function () {
  return typeof this.containerSizeFn === 'function' ? this.containerSizeFn() : this.containerSizeFn;
};

WalkontableAbstractStrategy.prototype.countVisible = function () {
  return this.cellCount;
};

WalkontableAbstractStrategy.prototype.isLastIncomplete = function () {
  return this.remainingSize > 0;
};