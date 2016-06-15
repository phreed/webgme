/**
https://editor.webgme.org/docs/source/index.html
*/

export declare namespace gme {

  export interface PluginConfig {
    serialize(): any;
  }

  export class PluginBase {
    activeNode: any;
    activeSelection: any[];
    blobClient: any;
    core: any;
    gmeConfig: any;
    logger: any;
    META: any;
    namespace: string;
    pluginMetadata: any;
    project: any;
    result: any;
    rootNode: any;

    addCommitToResult(status: string): void;
    baseIsMeta(node: any): boolean;
    configure(config: PluginConfig): void;
    createMessage(node: any, message: string, serverity: string): void;
    getConfigStructure(): any;
    getCurrentConfig(): PluginConfig;
    getDefaultConfig(): PluginConfig;
    getDescription(): string;
    getMetadata(): any;
    getMetaType(node: any): any;
    getName(): string;
    getVersion(): string;
    initialize(logger: any, blobClient: any, gmeConfig: any): void;
    isInvalidActiveNode(pluginId: any): any;
    isMetaTypeOf(node: any, metaNode: any): boolean;
    main(callback: any): void;
    save(message: string): void;
    sendNotification(message: string, callback?: any): void;
    setCurrentConfig(newConfig: PluginConfig): void;
    updateMeta(generatedMeta: any): void;
    updateSuccess(value: boolean, message: TemplateStringsArray): void;
  }

}

export var PluginConfig: gme.PluginConfig;
export var PluginBase: gme.PluginBase;
