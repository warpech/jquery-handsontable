import { arrayEach } from '../../../helpers/array';
import TreeNode, { TRAVERSAL_BF } from '../../../utils/dataStructures/tree';

/* eslint-disable jsdoc/require-description-complete-sentence */
/**
 * The header tree class keeps nested header settings in the tree
 * structure for easier node manipulation (e.q collapse or expand column).
 * That trees represent the current state of the nested headers. From the
 * trees, the colspan matrix is generated for nested header renderers.
 *
 * The second role of the module is validation. While building the tree,
 * there is checked whether the configuration contains overlapping
 * headers. If true, then the exception is thrown.
 *
 * For example, for that header configuration:
 *   +----+----+----+----+----+
 *   │ A1                │ A2 │
 *   +----+----+----+----+----+
 *   │ B1           │ B2 │ B3 │
 *   +----+----+----+----+----+
 *   │ C1      │ C2 │ C3 │ C4 │
 *   +----+----+----+----+----+
 *
 * The tree structures look like:
 *                (0)                      (4)           // a visual column index
 *                 │                        │
 *        .------(A1)------.              (A2)--.
 *   .--(B1)--.           (B2)--.              (B3)--.
 *  (C1)     (C2)              (C3)                 (C4)
 *
 * @type {HeadersTree}
 */
/* eslint-enable jsdoc/require-description-complete-sentence */
export default class HeadersTree {
  /**
   * The collection of nested headers structured into trees.
   *
   * @private
   * @type {Map<number, TreeNode>}
   */
  #rootNodes = new Map();
  /**
   * @type {Map<number, number>}
   */
  #rootsIndex = new Map();
  /**
   * The instance of the SourceSettings class.
   *
   * @type {SourceSettings}
   */
  #sourceSettings = null;

  constructor(sourceSettings) {
    this.#sourceSettings = sourceSettings;
  }

  /**
   * Gets an array of the all root nodes.
   *
   * @returns {TreeNode[]}
   */
  getRoots() {
    return Array.from(this.#rootNodes.values());
  }

  /**
   * Gets an root nodes by specified visual column index.
   *
   * @param {number} visualColumnIndex A visual column index.
   * @returns {TreeNode|undefined}
   */
  getRootByColumn(visualColumnIndex) {
    let node;

    if (this.#rootsIndex.has(visualColumnIndex)) {
      node = this.#rootNodes.get(this.#rootsIndex.get(visualColumnIndex));
    }

    return node;
  }

  /**
   * @param {number} visualColumnIndex
   * @param {number} headerLevel
   */
  getNode(visualColumnIndex, headerLevel) {
    const rootNode = this.getRootByColumn(visualColumnIndex);

    if (!rootNode) {
      return;
    }

    // Normalize the visual column index to a 0-based system for a specific "box" defined by root node colspan width.
    const normalizedColumnIndex = visualColumnIndex - this.#rootsIndex.get(visualColumnIndex);
    let columnCursor = 0;
    let treeNode;

    // Collect all parent nodes that depend on the collapsed node.
    rootNode.walkDown((node) => {
      const { data: { colspan, headerLevel: nodeHeaderLevel } } = node;

      if (headerLevel === nodeHeaderLevel) {
        if (normalizedColumnIndex >= columnCursor && normalizedColumnIndex <= columnCursor + colspan - 1) {
          treeNode = node;

          return false; // Cancel tree traversing.
        }

        columnCursor += colspan;
      }
    }, TRAVERSAL_BF);

    return treeNode;
  }

  /**
   * Builds (or rebuilds if called again) root nodes indexes.
   */
  rebuildTreeIndex() {
    const origRootNodes = Array.from(this.#rootNodes);
    let columnIndex = 0;

    this.#rootsIndex.clear();
    this.#rootNodes.clear();

    arrayEach(origRootNodes, ([, rootNode]) => {
      this.#rootNodes.set(columnIndex, rootNode);

      // Map tree range (colspan range/width) into visual column index of the root node.
      for (let i = columnIndex; i < columnIndex + rootNode.data.colspan; i++) {
        this.#rootsIndex.set(i, columnIndex);
      }

      columnIndex += rootNode.data.colspan;
    });
  }

  /**
   * Builds trees based on SourceSettings class. Calling a method causes clearing the tree state built
   * from the previous call.
   */
  buildTree() {
    this.clear();

    const columnsCount = this.#sourceSettings.getColumnsCount();
    let columnIndex = 0;

    while (columnIndex < columnsCount) {
      const columnSettings = this.#sourceSettings.getColumnSettings(0, columnIndex);
      const rootNode = new TreeNode();

      this.#rootNodes.set(columnIndex, rootNode);
      this.buildLeaves(rootNode, columnIndex, 0, columnSettings.colspan);

      columnIndex += columnSettings.colspan;
    }

    this.rebuildTreeIndex();
  }

  /**
   * Builds leaves for specified tree node.
   *
   * @param {TreeNode} parentNode A node to which the leaves applies.
   * @param {number} columnIndex A visual column index.
   * @param {number} headerLevel Currently processed header level.
   * @param {number} [extractionLength=1] Determines column extraction length for node children.
   */
  buildLeaves(parentNode, columnIndex, headerLevel, extractionLength = 1) {
    const columnsSettings = this.#sourceSettings.getColumnsSettings(headerLevel, columnIndex, extractionLength);

    headerLevel += 1;

    arrayEach(columnsSettings, (columnSettings) => {
      const nodeData = {
        ...columnSettings,
        headerLevel: headerLevel - 1,
      };
      let node;

      if (headerLevel === 1) { // fill the root node
        parentNode.data = nodeData;
        node = parentNode;
      } else {
        node = new TreeNode(nodeData);
        node.parent = parentNode;

        parentNode.childs.push(node);
      }

      if (headerLevel < this.#sourceSettings.getLayersCount()) {
        this.buildLeaves(node, columnIndex, headerLevel, columnSettings.colspan);
      }

      columnIndex += columnSettings.colspan;
    });
  }

  /**
   * Clears the tree to the initial state.
   */
  clear() {
    this.#rootNodes.clear();
    this.#rootsIndex.clear();
  }
}