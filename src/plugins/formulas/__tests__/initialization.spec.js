import HyperFormula, {
  FunctionPlugin
} from 'hyperformula';
import plPL from 'hyperformula/es/i18n/languages/plPL';

describe('Formulas general', () => {
  const debug = false;
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
    this.$container2 = $(`<div id="${id}-2"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (debug) {
      return;
    }

    if (this.$container) {
      try {
        if (this.$container.handsontable('getInstance')) {
          destroy();
        }
      } catch (e) {
        // In some of the test cases we're manually destroying the Handsontable instances, so 'getInstance' may
        // throw a post-mortem error.
        if (!e.message.includes('instance has been destroyed')) {
          throw e;
        }
      }

      this.$container.remove();
    }

    if (this.$container2) {
      try {
        if (this.$container2.handsontable('getInstance')) {
          this.$container2.handsontable('getInstance').destroy();
        }
      } catch (e) {
        // In some of the test cases we're manually destroying the Handsontable instances, so 'getInstance' may
        // throw a post-mortem error.
        if (!e.message.includes('instance has been destroyed')) {
          throw e;
        }
      }
      this.$container2.remove();
    }
  });

  describe('Single Handsontable setup', () => {
    it('should throw an error, when no `hyperformula` key was passed to the `formulas` settings', () => {
      /* eslint-disable no-console */
      const errorSpy = jasmine.createSpyObj('error', ['test']);
      const prevError = console.error;

      console.error = (...args) => {
        errorSpy.test(...args);
        prevError(...args);
      };

      const hot = handsontable({
        data: getDataSimpleExampleFormulas(),
        formulas: true,
        licenseKey: 'non-commercial-and-evaluation'
      });

      expect(errorSpy.test).toHaveBeenCalledWith(
        'Missing the required `hyperformula` key in the Formulas settings. ' +
        'Please fill it with either a HyperFormula class or a HyperFormula instance.');
      expect(hot.getPlugin('formulas').enabled).toBe(false);

      console.error = prevError;
      /* eslint-enable no-console */
    });

    it('should initialize a single working Handsontable instance and a single HyperFormula instance, when HF class' +
      ' was passed to the `formulas` settings', () => {
      const hot = handsontable({
        data: getDataSimpleExampleFormulas(),
        formulas: {
          hyperformula: HyperFormula
        },
        licenseKey: 'non-commercial-and-evaluation'
      });
      const hfInstances = hot.getPlugin('formulas').staticRegister.getItem('hyperformulaInstances');
      const relatedHfInstanceEntry = hfInstances.get(hot.getPlugin('formulas').hyperformula);

      expect(getDataAtCell(4, 1)).toEqual(8042);
      expect(hfInstances.size).toBeGreaterThanOrEqual(1);
      expect(relatedHfInstanceEntry.length).toEqual(1);
      expect(relatedHfInstanceEntry[0]).toEqual(hot.guid);
    });

    it('should initialize a single working Handsontable instance, when an external HyperFormula instance was passed' +
      ' to the `formulas` settings', () => {
      const hfInstance = HyperFormula.buildEmpty({ licenseKey: 'internal-use-in-handsontable' });
      const hot = handsontable({
        data: getDataSimpleExampleFormulas(),
        formulas: {
          hyperformula: hfInstance
        },
        licenseKey: 'non-commercial-and-evaluation'
      });
      const hfInstances = hot.getPlugin('formulas').staticRegister.getItem('hyperformulaInstances');
      const relatedHfInstanceEntry = hfInstances ?
        hfInstances.get(hot.getPlugin('formulas').hyperformula) :
        void 0;
      // The registry (for the related HF instance) can be empty or undefined, depending on the context:
      // - if it's the first HOT instance on the page, it will be undefined (no registry will be ever created, because
      //   there's no need for it
      // - if it's not the first HOT instance (which will be usually the case with the test cases), the registry can be
      //   already created, but there should be no entry for the provided HyperFormula instance.
      const noEntryInRegistry = hfInstances === void 0 || relatedHfInstanceEntry === void 0;

      expect(getDataAtCell(4, 1)).toEqual(8042);
      expect(noEntryInRegistry).toBe(true);
    });
  });

  describe('Multiple Handsontable setup', () => {
    describe('with separate HF instances', () => {
      it('should create separate HF instances, when multiple HOT instances are initialized with HF classes passed' +
        ' to the `formulas` settings.', () => {
        const hot1 = handsontable({
          data: getDataSimpleExampleFormulas(),
          formulas: {
            hyperformula: HyperFormula
          },
          licenseKey: 'non-commercial-and-evaluation'
        });

        const hot2 = spec().$container2.handsontable({
          data: getDataSimpleExampleFormulas(),
          formulas: {
            hyperformula: HyperFormula
          },
          licenseKey: 'non-commercial-and-evaluation'
        }).data('handsontable');

        const hfInstances = hot1.getPlugin('formulas').staticRegister.getItem('hyperformulaInstances');
        const formulasPlugin1 = hot1.getPlugin('formulas');
        const formulasPlugin2 = hot2.getPlugin('formulas');
        const relatedHfInstanceEntry1 = hfInstances ? hfInstances.get(formulasPlugin1.hyperformula) : void 0;
        const relatedHfInstanceEntry2 = hfInstances ? hfInstances.get(formulasPlugin2.hyperformula) : void 0;

        expect(formulasPlugin1.hyperformula !== formulasPlugin2.hyperformula).withContext('Both of the HOT instances' +
          ' should have separate HF instances.').toBe(true);
        expect(relatedHfInstanceEntry1[0]).toEqual(hot1.guid);
        expect(relatedHfInstanceEntry2[0]).toEqual(hot2.guid);
      });

      it('should create separate HF instances, when multiple HOT instances are initialized with HF external' +
        ' instances' +
        ' passed to the `formulas` settings.', () => {
        const hfInstance1 = HyperFormula.buildEmpty({ licenseKey: 'internal-use-in-handsontable' });
        const hfInstance2 = HyperFormula.buildEmpty({ licenseKey: 'internal-use-in-handsontable' });
        const hot1 = handsontable({
          data: getDataSimpleExampleFormulas(),
          formulas: {
            hyperformula: hfInstance1
          },
          licenseKey: 'non-commercial-and-evaluation'
        });

        const hot2 = spec().$container2.handsontable({
          data: getDataSimpleExampleFormulas(),
          formulas: {
            hyperformula: hfInstance2
          },
          licenseKey: 'non-commercial-and-evaluation'
        }).data('handsontable');

        const hfInstances = hot1.getPlugin('formulas').staticRegister.getItem('hyperformulaInstances');
        const formulasPlugin1 = hot1.getPlugin('formulas');
        const formulasPlugin2 = hot2.getPlugin('formulas');
        const relatedHfInstanceEntry1 = hfInstances ? hfInstances.get(formulasPlugin1.hyperformula) : void 0;
        const relatedHfInstanceEntry2 = hfInstances ? hfInstances.get(formulasPlugin2.hyperformula) : void 0;
        // The registry (for the related HF instance) can be empty or undefined, depending on the context:
        // - if it's the first HOT instance on the page, it will be undefined (no registry will be ever created,
        // because
        //   there's no need for it
        // - if it's not the first HOT instance (which will be usually the case with the test cases), the registry can
        // be already created, but there should be no entry for the provided HyperFormula instance.
        const noEntryInRegistry1 = hfInstances === void 0 || relatedHfInstanceEntry1 === void 0;
        const noEntryInRegistry2 = hfInstances === void 0 || relatedHfInstanceEntry2 === void 0;

        expect(formulasPlugin1.hyperformula !== formulasPlugin2.hyperformula).withContext('Both of the HOT instances' +
          ' should have separate HF instances.').toBe(true);
        expect(noEntryInRegistry1).withContext('There should be no entry in the global registry for the first HOT' +
          ' instance.').toBe(true);
        expect(noEntryInRegistry2).withContext('There should be no entry in the global registry for the second HOT' +
          ' instance.').toBe(true);
      });

      it('should destroy the HF instance connected to a HOT instance after destroying said HOT instance if it was' +
        ' created using a HF class', () => {
        const hot1 = handsontable({
          data: getDataSimpleExampleFormulas(),
          formulas: {
            hyperformula: HyperFormula
          },
          licenseKey: 'non-commercial-and-evaluation'
        });

        const hot2 = spec().$container2.handsontable({
          data: getDataSimpleExampleFormulas(),
          formulas: {
            hyperformula: HyperFormula
          },
          licenseKey: 'non-commercial-and-evaluation'
        }).data('handsontable');

        const formulasPlugin1HF = hot1.getPlugin('formulas').hyperformula;
        const formulasPlugin2HF = hot2.getPlugin('formulas').hyperformula;
        const destroySpy1 = spyOn(formulasPlugin1HF, 'destroy');
        const destroySpy2 = spyOn(formulasPlugin2HF, 'destroy');

        hot2.destroy();

        expect(destroySpy1).not.toHaveBeenCalled();
        expect(destroySpy2).toHaveBeenCalled();
      });

      it('should NOT destroy the HF instance connected to a HOT instance after destroying said HOT instance if it' +
        ' was' +
        ' created using a HF instance', () => {
        const hfInstance1 = HyperFormula.buildEmpty({ licenseKey: 'internal-use-in-handsontable' });
        const hfInstance2 = HyperFormula.buildEmpty({ licenseKey: 'internal-use-in-handsontable' });
        const hot1 = handsontable({
          data: getDataSimpleExampleFormulas(),
          formulas: {
            hyperformula: hfInstance1
          },
          licenseKey: 'non-commercial-and-evaluation'
        });

        const hot2 = spec().$container2.handsontable({
          data: getDataSimpleExampleFormulas(),
          formulas: {
            hyperformula: hfInstance2
          },
          licenseKey: 'non-commercial-and-evaluation'
        }).data('handsontable');

        const formulasPlugin1HF = hot1.getPlugin('formulas').hyperformula;
        const formulasPlugin2HF = hot2.getPlugin('formulas').hyperformula;
        const destroySpy1 = spyOn(formulasPlugin1HF, 'destroy');
        const destroySpy2 = spyOn(formulasPlugin2HF, 'destroy');

        hot2.destroy();

        expect(destroySpy1).not.toHaveBeenCalled();
        expect(destroySpy2).not.toHaveBeenCalled();
      });
    });

    describe('with a shared HF instances', () => {
      it('should create a global, shared HF instance, when one HOT instance is initialized with the HF class, and' +
        ' others are set up with a reference to the first HOT instance', () => {
        const hot1 = handsontable({
          data: getDataSimpleExampleFormulas(),
          formulas: {
            hyperformula: HyperFormula
          },
          licenseKey: 'non-commercial-and-evaluation'
        });

        const hot2 = spec().$container2.handsontable({
          data: getDataSimpleExampleFormulas(),
          formulas: {
            hyperformula: hot1.getPlugin('formulas').hyperformula
          },
          licenseKey: 'non-commercial-and-evaluation'
        }).data('handsontable');

        const hfInstances = hot1.getPlugin('formulas').staticRegister.getItem('hyperformulaInstances');
        const formulasPlugin1HF = hot1.getPlugin('formulas').hyperformula;
        const formulasPlugin2HF = hot2.getPlugin('formulas').hyperformula;
        const relatedHfInstanceEntry1 = hfInstances ? hfInstances.get(formulasPlugin1HF) : void 0;
        const relatedHfInstanceEntry2 = hfInstances ? hfInstances.get(formulasPlugin2HF) : void 0;

        expect(formulasPlugin1HF).toEqual(formulasPlugin2HF);
        expect(relatedHfInstanceEntry1).toEqual(relatedHfInstanceEntry2);
        expect(relatedHfInstanceEntry1.length).toEqual(2);
        expect(relatedHfInstanceEntry1[0]).toEqual(hot1.guid);
        expect(relatedHfInstanceEntry1[1]).toEqual(hot2.guid);
      });

      it('should NOT destroy a shared HF instance if only one of the "connected" HOT instances i destroyed, but' +
        ' should remove the HOT guid from the global registry', () => {
        const hot1 = handsontable({
          data: getDataSimpleExampleFormulas(),
          formulas: {
            hyperformula: HyperFormula
          },
          licenseKey: 'non-commercial-and-evaluation'
        });

        const hot2 = spec().$container2.handsontable({
          data: getDataSimpleExampleFormulas(),
          formulas: {
            hyperformula: hot1.getPlugin('formulas').hyperformula
          },
          licenseKey: 'non-commercial-and-evaluation'
        }).data('handsontable');

        const hfInstances = hot1.getPlugin('formulas').staticRegister.getItem('hyperformulaInstances');
        const formulasPlugin1HF = hot1.getPlugin('formulas').hyperformula;
        const relatedHfInstanceEntry = hfInstances ? hfInstances.get(formulasPlugin1HF) : void 0;

        hot1.destroy();

        expect(relatedHfInstanceEntry.length).toEqual(1);
        expect(relatedHfInstanceEntry[0]).toEqual(hot2.guid);
      });

      it('should destroy a shared HF instance only after every "connected" HOT instances is destroyed and remove the' +
        ' HF entry from the global registry', () => {
        const hot1 = handsontable({
          data: getDataSimpleExampleFormulas(),
          formulas: {
            hyperformula: HyperFormula
          },
          licenseKey: 'non-commercial-and-evaluation'
        });

        const hot2 = spec().$container2.handsontable({
          data: getDataSimpleExampleFormulas(),
          formulas: {
            hyperformula: hot1.getPlugin('formulas').hyperformula
          },
          licenseKey: 'non-commercial-and-evaluation'
        }).data('handsontable');

        const hfInstances = hot1.getPlugin('formulas').staticRegister.getItem('hyperformulaInstances');
        const formulasPlugin1HF = hot1.getPlugin('formulas').hyperformula;
        const destroySpy = spyOn(formulasPlugin1HF, 'destroy');

        hot1.destroy();
        hot2.destroy();

        expect(hfInstances.get(formulasPlugin1HF)).toBe(void 0);
        expect(destroySpy).toHaveBeenCalled();
      });
    });
  });

  describe('Sheet creation', () => {
    describe('`data` key present', () => {
      describe('`sheetName` provided', () => {
        it('should overwrite the HF sheet data with the provided `data`, if there\'s an existing sheet with that name' +
          ' in the connected HF instance', () => {
          const hfInstance1 = HyperFormula.buildEmpty({ licenseKey: 'internal-use-in-handsontable' });
          hfInstance1.addSheet('Test Sheet');
          hfInstance1.setSheetContent('Test Sheet', [[1, 2, 3], [4, 5, 6]]);

          handsontable({
            data: [['foo']],
            formulas: {
              hyperformula: hfInstance1,
              sheetName: 'Test Sheet'
            },
            licenseKey: 'non-commercial-and-evaluation'
          });

          const plugin = getPlugin('formulas');

          expect(plugin.sheetName).toEqual('Test Sheet');
          expect(plugin.sheetId).toEqual(hfInstance1.getSheetId('Test Sheet'));
          expect(hfInstance1.getSheetSerialized(hfInstance1.getSheetId('Test Sheet'))).toEqual([['foo']]);
        });

        it('should create (and fill with data) a new HF sheet with an the provided name (and apply the sheet name and' +
          ' sheet id to the plugin), when there\'s a `sheetName` defined in the plugin settings', () => {
          const hfInstance1 = HyperFormula.buildEmpty({ licenseKey: 'internal-use-in-handsontable' });

          handsontable({
            data: [['foo']],
            formulas: {
              hyperformula: hfInstance1,
              sheetName: 'Test Sheet'
            },
            licenseKey: 'non-commercial-and-evaluation'
          });

          const plugin = getPlugin('formulas');

          expect(plugin.sheetName).toEqual('Test Sheet');
          expect(plugin.sheetId).toEqual(hfInstance1.getSheetId('Test Sheet'));
          expect(hfInstance1.getSheetSerialized(hfInstance1.getSheetId('Test Sheet'))).toEqual([['foo']]);
        });
      });

      describe('`sheetName` not provided', () => {
        it('should create (and fill with data) a new HF sheet with an auto-generated name (and apply the sheet name' +
          ' and sheet id to the plugin), when there\'s no `sheetName` defined in the plugin settings', () => {
          const hfInstance1 = HyperFormula.buildEmpty({ licenseKey: 'internal-use-in-handsontable' });

          handsontable({
            data: [['foo']],
            formulas: {
              hyperformula: hfInstance1
            },
            licenseKey: 'non-commercial-and-evaluation'
          });

          const plugin = getPlugin('formulas');

          expect(plugin.sheetId).toEqual(hfInstance1.getSheetId(plugin.sheetName));
          expect(hfInstance1.getSheetSerialized(hfInstance1.getSheetId(plugin.sheetName))).toEqual([['foo']]);
        });
      });
    });

    describe('`data` key not present', () => {
      describe('`sheetName` provided', () => {
        it('should create a new empty HF sheet with a provided `sheetName`, if there\' one provided in the plugin' +
          ' settings and no sheet exists in HF with the same name', () => {
          const hfInstance1 = HyperFormula.buildEmpty({ licenseKey: 'internal-use-in-handsontable' });

          handsontable({
            formulas: {
              hyperformula: hfInstance1,
              sheetName: 'Test Sheet'
            },
            licenseKey: 'non-commercial-and-evaluation'
          });

          const plugin = getPlugin('formulas');

          expect(plugin.sheetName).toEqual('Test Sheet');
          expect(plugin.sheetId).toEqual(hfInstance1.getSheetId('Test Sheet'));
          expect(
            hfInstance1.getSheetDimensions(hfInstance1.getSheetId(plugin.sheetName))
          ).toEqual({
            width: 0,
            height: 0
          });
        });

        it('should switch to an existing HF sheet, if it\'s already created with the same `sheetName` and the sheet' +
          ' name is provided in the settings', () => {
          const hfInstance1 = HyperFormula.buildEmpty({ licenseKey: 'internal-use-in-handsontable' });
          hfInstance1.addSheet('Test Sheet');
          hfInstance1.setSheetContent('Test Sheet', [[1, 2, 3], [4, 5, 6]]);

          handsontable({
            formulas: {
              hyperformula: hfInstance1,
              sheetName: 'Test Sheet'
            },
            licenseKey: 'non-commercial-and-evaluation'
          });

          const plugin = getPlugin('formulas');

          expect(plugin.sheetName).toEqual('Test Sheet');
          expect(plugin.sheetId).toEqual(hfInstance1.getSheetId('Test Sheet'));

          expect(getData()).toEqual([[1, 2, 3], [4, 5, 6]]);
          expect(hfInstance1.getSheetSerialized(hfInstance1.getSheetId('Test Sheet'))).toEqual([[1, 2, 3], [4, 5, 6]]);
        });
      });

      describe('`sheetName` not provided', () => {
        it('should create a new empty HF sheet with an auto-generated name, if `sheetName` is not provided in the' +
          ' plugin settings', () => {
          const hfInstance1 = HyperFormula.buildEmpty({ licenseKey: 'internal-use-in-handsontable' });

          handsontable({
            formulas: {
              hyperformula: hfInstance1
            },
            licenseKey: 'non-commercial-and-evaluation'
          });

          const plugin = getPlugin('formulas');

          expect(plugin.sheetId).toEqual(hfInstance1.getSheetId(plugin.sheetName));

          expect(getData()).toEqual(hfInstance1.getSheetSerialized(plugin.sheetId));
          expect(hfInstance1.doesSheetExist(plugin.sheetName)).toEqual(true);
          expect(hfInstance1.getSheetSerialized(plugin.sheetId)).toEqual([]);
        });
      });
    });
  });

  describe('Updating HF settings', () => {
    it('should initialize HyperFormula with the default set of settings', () => {
      handsontable({
        formulas: {
          hyperformula: HyperFormula
        },
        licenseKey: 'non-commercial-and-evaluation'
      });

      const plugin = getPlugin('formulas');
      const hfConfig = plugin.hyperformula.getConfig();

      expect(hfConfig.binarySearchThreshold).toEqual(20);
      expect(hfConfig.matrixDetection).toEqual(true);
      expect(hfConfig.matrixDetectionThreshold).toEqual(100);
      expect(hfConfig.useColumnIndex).toEqual(false);
      expect(hfConfig.useStats).toEqual(false);
      expect(hfConfig.evaluateNullToZero).toEqual(true);
      expect(hfConfig.precisionEpsilon).toEqual(1e-13);
      expect(hfConfig.precisionRounding).toEqual(14);
      expect(hfConfig.smartRounding).toEqual(true);
      expect(hfConfig.leapYear1900).toEqual(true);
    });

    it('should update the HyperFormula config with the default set of settings', () => {
      const hfInstance1 = HyperFormula.buildEmpty({ licenseKey: 'internal-use-in-handsontable' });
      hfInstance1.updateConfig({
        binarySearchThreshold: 25,
        matrixDetection: false,
        matrixDetectionThreshold: 125,
        useColumnIndex: true,
        useStats: true,
      });

      handsontable({
        formulas: {
          hyperformula: hfInstance1
        },
        licenseKey: 'non-commercial-and-evaluation'
      });

      const plugin = getPlugin('formulas');
      const hfConfig = plugin.hyperformula.getConfig();

      expect(hfConfig.binarySearchThreshold).toEqual(20);
      expect(hfConfig.matrixDetection).toEqual(true);
      expect(hfConfig.matrixDetectionThreshold).toEqual(100);
      expect(hfConfig.useColumnIndex).toEqual(false);
      expect(hfConfig.useStats).toEqual(false);
      expect(hfConfig.evaluateNullToZero).toEqual(true);
      expect(hfConfig.precisionEpsilon).toEqual(1e-13);
      expect(hfConfig.precisionRounding).toEqual(14);
      expect(hfConfig.smartRounding).toEqual(true);
      expect(hfConfig.leapYear1900).toEqual(true);
    });

    it('should update the HyperFormula configuration with the options defined in `formulas.hyperFormulaConfig`', () => {
      handsontable({
        formulas: {
          hyperformula: HyperFormula,
          hyperformulaConfig: {
            binarySearchThreshold: 25,
            matrixDetection: false,
            matrixDetectionThreshold: 125,
            useColumnIndex: true,
            useStats: true,
          }
        },
        licenseKey: 'non-commercial-and-evaluation'
      });

      const plugin = getPlugin('formulas');
      const hfConfig = plugin.hyperformula.getConfig();

      expect(hfConfig.binarySearchThreshold).toEqual(25);
      expect(hfConfig.matrixDetection).toEqual(false);
      expect(hfConfig.matrixDetectionThreshold).toEqual(125);
      expect(hfConfig.useColumnIndex).toEqual(true);
      expect(hfConfig.useStats).toEqual(true);
    });
  });

  describe('Cross-referencing', () => {
    it('should allow cross-references between HOT instances', () => {
      const hot1 = handsontable({
        data: [['hello from sheet 1'], ['=Sheet2!A2']],
        formulas: {
          hyperformula: HyperFormula,
          sheetName: 'Sheet1'
        },
        licenseKey: 'non-commercial-and-evaluation'
      });

      const hot2 = spec().$container2.handsontable({
        data: [['=Sheet1!A1'], ['hello from sheet 2']],
        formulas: {
          hyperformula: getPlugin('formulas').hyperformula,
          sheetName: 'Sheet2'
        },
        licenseKey: 'non-commercial-and-evaluation'
      }).data('handsontable');

      expect(hot1.getDataAtCell(1, 0)).toEqual('hello from sheet 2');
      expect(hot2.getDataAtCell(0, 0)).toEqual('hello from sheet 1');
    });

    it('should auto-update the cells referenced between "linked" HOT instances after one of the is modified', () => {
      const hot1 = handsontable({
        data: [['hello from sheet 1'], ['=Sheet2!A2']],
        formulas: {
          hyperformula: HyperFormula,
          sheetName: 'Sheet1'
        },
        licenseKey: 'non-commercial-and-evaluation'
      });

      const hot2 = spec().$container2.handsontable({
        data: [['=Sheet1!A1'], ['hello from sheet 2']],
        formulas: {
          hyperformula: getPlugin('formulas').hyperformula,
          sheetName: 'Sheet2'
        },
        licenseKey: 'non-commercial-and-evaluation'
      }).data('handsontable');

      hot1.setDataAtCell(0, 0, 'Hello from 1');

      expect(hot2.getCell(0, 0).innerText).toEqual('Hello from 1');

      hot2.setDataAtCell(1, 0, 'Hello from 2');

      expect(hot1.getCell(1, 0).innerText).toEqual('Hello from 2');
    });
  });

  describe('Registering custom HF settings', () => {
    it('should register the provided named expressions before creating the HF instance', () => {
      handsontable({
        data: [['=MyLocal']],
        formulas: {
          hyperformula: HyperFormula,
          sheetName: 'Sheet1',
          namedExpressions: [
            {
              name: 'MyLocal',
              expression: '1234'
            }
          ]
        },
        licenseKey: 'non-commercial-and-evaluation'
      });

      expect(getDataAtCell(0, 0)).toEqual(1234);
    });

    it('should register custom function plugins before creating the HF instance', () => {
      class CustomFP extends FunctionPlugin {
        customFP() {
          return 'customFP output';
        }
      }

      CustomFP.implementedFunctions = {
        CUSTOMFP: {
          method: 'customFP',
        }
      };

      handsontable({
        data: [['=CUSTOMFP()']],
        formulas: {
          hyperformula: HyperFormula,
          sheetName: 'Sheet1',
          functions: [
            {
              name: 'CUSTOMFP',
              plugin: CustomFP,
              translations: {
                enGB: {
                  CUSTOMFP: 'CUSTOMFP'
                }
              }
            }
          ]
        },
        licenseKey: 'non-commercial-and-evaluation'
      });

      expect(getDataAtCell(0, 0)).toEqual('customFP output');
    });

    it('should register a language applying it to the HF instance', () => {
      handsontable({
        data: [['TEST'], ['=LITERY.MAŁE(A1)']],
        formulas: {
          hyperformula: HyperFormula,
          sheetName: 'Sheet1',
          language: {
            code: 'plPL',
            language: plPL
          }
        },
        licenseKey: 'non-commercial-and-evaluation'
      });

      expect(getDataAtCell(1, 0)).toEqual('test');
    });
  });
});