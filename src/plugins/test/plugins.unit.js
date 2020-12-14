import {
  getPlugin,
  getPluginsNames,
  registerPlugin,
} from '../index';

describe('plugins', () => {
  describe('registering', () => {
    it('should register plugin under an alias', () => {
      const pluginName = 'pluginA';
      const pluginRef = jest.fn();

      registerPlugin(pluginName, pluginRef);
      expect(getPlugin(pluginName)).toBe(pluginRef);
    });

    it('should throw an error if there is already registered plugin at the same name', () => {
      const pluginName = 'pluginA';
      const pluginRef = jest.fn();

      expect(() => {
        registerPlugin(pluginName, pluginRef);
      }).toThrowError();
    });

    it('should register plugins in the correct order', () => {
      const pluginRef = jest.fn();

      registerPlugin('pluginB', pluginRef, 10);
      registerPlugin('pluginC', pluginRef);
      registerPlugin('pluginD', pluginRef, 30);
      registerPlugin('pluginE', pluginRef, 20);
      registerPlugin('pluginF', pluginRef);
      registerPlugin('pluginG', pluginRef, 0);

      expect(getPluginsNames()).toEqual([
        'PluginG',
        'PluginB',
        'PluginE',
        'PluginD',
        'PluginA',
        'PluginC',
        'PluginF',
      ]);
    });

    it('should throw an error if there is already registered plugin at the same priority', () => {
      const pluginRef = jest.fn();

      expect(() => {
        registerPlugin('pluginH', pluginRef, 0);
      }).toThrowError();
    });
  });
});