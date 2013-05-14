"use strict";

define(['logManager',
    'clientUtil',
    'js/Constants',
    'js/NodePropertyNames'], function (logManager,
                                                        util,
                                                        CONSTANTS,
                                                        nodePropertyNames) {

    var ModelEditorControlDiagramDesignerWidgetEventHandlers,
        ATTRIBUTES_STRING = "attributes",
        REGISTRY_STRING = "registry",
        CONNECTION_SOURCE_NAME = "source",
        CONNECTION_TARGET_NAME = "target";

    ModelEditorControlDiagramDesignerWidgetEventHandlers = function () {
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype.attachDiagramDesignerWidgetEventHandlers = function () {
        var self = this;

        /*OVERRIDE DESIGNER CANVAS METHODS*/
        this.designerCanvas.onDesignerItemsMove = function (repositionDesc) {
            self._onDesignerItemsMove(repositionDesc);
        };

        this.designerCanvas.onDesignerItemsCopy = function (copyDesc) {
            self._onDesignerItemsCopy(copyDesc);
        };

        this.designerCanvas.onCreateNewConnection = function (params) {
            self._onCreateNewConnection(params);
        };

        this.designerCanvas.onSelectionDelete = function (idList) {
            self._onSelectionDelete(idList);
        };

        this.designerCanvas.onDesignerItemDoubleClick = function (id, event) {
            self._onDesignerItemDoubleClick(id, event);
        };

        this.designerCanvas.onModifyConnectionEnd = function (params) {
            self._onModifyConnectionEnd(params);
        };

        this.designerCanvas.onRegisterSubcomponent = function (objID, sCompID, metaInfo) {
            self._onRegisterSubcomponent(objID, sCompID, metaInfo);
        };

        this.designerCanvas.onUnregisterSubcomponent = function (objID, sCompID) {
            self._onUnregisterSubcomponent(objID, sCompID);
        };

        this.designerCanvas.onGetCommonPropertiesForSelection = function (selectedObjectIDs) {
            return self._onGetCommonPropertiesForSelection(selectedObjectIDs);
        };

        this.designerCanvas.onPropertyChanged = function (selectedObjIDs, args) {
            self._onPropertyChanged(selectedObjIDs, args);
        };

        this.designerCanvas.onBackgroundDroppableAccept = function (helper) {
            return self._onBackgroundDroppableAccept(helper);
        };

        this.designerCanvas.onBackgroundDrop = function (helper, position) {
            self._onBackgroundDrop(helper, position);
        };

        this.designerCanvas.onSelectionChanged = function (selectedIds) {
            self._onSelectionChanged(selectedIds);
        };

        this.logger.debug("attachDiagramDesignerWidgetEventHandlers finished");
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onDesignerItemsMove = function (repositionDesc) {
        var id;

        this._client.startTransaction();
        for (id in repositionDesc) {
            if (repositionDesc.hasOwnProperty(id)) {
                this._client.setRegistry(this._ComponentID2GmeID[id], nodePropertyNames.Registry.position, { "x": repositionDesc[id].x, "y": repositionDesc[id].y });
            }
        }
        this._client.completeTransaction();
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onDesignerItemsCopy = function (copyDesc) {
        var copyOpts = { "parentId": this.currentNodeInfo.id },
            id,
            desc,
            gmeID;

        this.designerCanvas.beginUpdate();

        for (id in copyDesc.items) {
            if (copyDesc.items.hasOwnProperty(id)) {
                desc = copyDesc.items[id];
                gmeID = this._ComponentID2GmeID[desc.oItemId];

                copyOpts[gmeID] = {};
                copyOpts[gmeID][ATTRIBUTES_STRING] = {};
                copyOpts[gmeID][REGISTRY_STRING] = {};

                copyOpts[gmeID][REGISTRY_STRING][nodePropertyNames.Registry.position] = { "x": desc.posX, "y": desc.posY };

                //remove the component from UI
                //it will be recreated when the GME client calls back with the result
                this.designerCanvas.deleteComponent(id);
            }
        }

        for (id in copyDesc.connections) {
            if (copyDesc.connections.hasOwnProperty(id)) {
                desc = copyDesc.connections[id];
                gmeID = this._ComponentID2GmeID[desc.oConnectionId];

                copyOpts[gmeID] = {};

                //remove the component from UI
                //it will be recreated when the GME client calls back with the result
                this.designerCanvas.deleteComponent(id);
            }
        }

        this.designerCanvas.endUpdate();

        this._client.intellyPaste(copyOpts);
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onCreateNewConnection = function (params) {
        var sourceId,
            targetId;

        if (params.srcSubCompId !== undefined) {
            sourceId = this._Subcomponent2GMEID[params.src][params.srcSubCompId];
        } else {
            sourceId = this._ComponentID2GmeID[params.src];
        }

        if (params.dstSubCompId !== undefined) {
            targetId = this._Subcomponent2GMEID[params.dst][params.dstSubCompId];
        } else {
            targetId = this._ComponentID2GmeID[params.dst];
        }

        this._client.makeConnection({   "parentId": this.currentNodeInfo.id,
            "sourceId": sourceId,
            "targetId": targetId,
            "directed": true });

        var p = {   "parentId": this.currentNodeInfo.id,
            "sourceId": sourceId,
            "targetId": targetId,
            "directed": true };

        this.logger.warning("onCreateNewConnection: " + JSON.stringify(p));
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onSelectionDelete = function (idList) {
        var objIdList = [],
            i = idList.length;

        while(i--) {
            objIdList.pushUnique(this._ComponentID2GmeID[idList[i]]);
        }

        if (objIdList.length > 0) {
            this._client.delMoreNodes(objIdList);
        }
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onDesignerItemDoubleClick = function (id, event) {
        var gmeID = this._ComponentID2GmeID[id];

        if (gmeID) {
            //TODO: somewhat tricked here for DEBUG purposes
            if (event.offsetX < 20 && event.offsetY < 20) {
                this._switchToNextDecorator(gmeID);
            } else {
                this.logger.debug("Opening model with id '" + gmeID + "'");
                this._client.setSelectedObjectId(gmeID);
            }
        }
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onModifyConnectionEnd = function (params) {
        var gmeID = this._ComponentID2GmeID[params.id],
            oldDesc = params.old,
            newDesc = params.new,
            newEndPointGMEID;

        if (gmeID) {
            this._client.startTransaction();

            //update connection endpoint - SOURCE
            if (oldDesc.srcObjId !== newDesc.srcObjId ||
                oldDesc.srcSubCompId !== newDesc.srcSubCompId) {
                if (newDesc.srcSubCompId !== undefined ) {
                    newEndPointGMEID = this._Subcomponent2GMEID[newDesc.srcObjId][newDesc.srcSubCompId];
                } else {
                    newEndPointGMEID = this._ComponentID2GmeID[newDesc.srcObjId];
                }
                this._client.makePointer(gmeID, CONNECTION_SOURCE_NAME, newEndPointGMEID);
            }

            //update connection endpoint - TARGET
            if (oldDesc.dstObjId !== newDesc.dstObjId ||
                oldDesc.dstSubCompId !== newDesc.dstSubCompId) {
                if (newDesc.dstSubCompId !== undefined ) {
                    newEndPointGMEID = this._Subcomponent2GMEID[newDesc.dstObjId][newDesc.dstSubCompId];
                } else {
                    newEndPointGMEID = this._ComponentID2GmeID[newDesc.dstObjId];
                }
                this._client.makePointer(gmeID, CONNECTION_TARGET_NAME, newEndPointGMEID);
            }

            this._client.completeTransaction();
        }
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onRegisterSubcomponent = function (objID, sCompID, metaInfo) {
        //store that a subcomponent with a given ID has been added to object with objID
        this._GMEID2Subcomponent[metaInfo[CONSTANTS.GME_ID]] = this._GMEID2Subcomponent[metaInfo[CONSTANTS.GME_ID]] || {};
        this._GMEID2Subcomponent[metaInfo[CONSTANTS.GME_ID]][objID] = sCompID;

        this._Subcomponent2GMEID[objID] = this._Subcomponent2GMEID[objID] || {};
        this._Subcomponent2GMEID[objID][sCompID] = metaInfo[CONSTANTS.GME_ID];
        //TODO: add event handling here that a subcomponent appeared
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onUnregisterSubcomponent = function (objID, sCompID) {
        var gmeID = this._Subcomponent2GMEID[objID][sCompID];

        delete this._Subcomponent2GMEID[objID][sCompID];
        delete this._GMEID2Subcomponent[gmeID][objID];
        //TODO: add event handling here that a subcomponent disappeared
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._switchToNextDecorator = function (id) {
        var objDesc = this._getObjectDescriptor(id),
            nextDec = "DecoratorWithPorts";

        switch (objDesc.decorator) {
            case "DefaultDecorator":
                nextDec = "CircleDecorator";
                break;
            case "CircleDecorator":
                nextDec = "DecoratorWithPorts";
                break;
            case "DecoratorWithPorts":
                nextDec = "AttributesDecorator";
                break;
            case "AttributesDecorator":
                nextDec = "DefaultDecorator";
                break;
            default:
                break;
        }

        this._client.startTransaction();
        this._client.setRegistry(id, nodePropertyNames.Registry.decorator, nextDec);
        this._client.completeTransaction();
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onGetCommonPropertiesForSelection = function (selectedObjIDs) {
        var propList = {},
            selectionLength = selectedObjIDs.length,
            cNode,
            i,
            flattenedAttrs,
            flattenedRegs,
            commonAttrs = {},
            commonRegs = {},
            noCommonValueColor = "#787878",
            _getNodePropertyValues, //fn
            _filterCommon, //fn
            _addItemsToResultList; //fn

        _getNodePropertyValues = function (node, propNameFn, propValueFn) {
            var result =  {},
                attrNames = node[propNameFn](),
                len = attrNames.length;

            while (--len >= 0) {
                result[attrNames[len]] = node[propValueFn](attrNames[len]);
            }

            return util.flattenObject(result);
        };

        _filterCommon = function (resultList, otherList, initPhase) {
            var it;

            if (initPhase === true) {
                for (it in otherList) {
                    if (otherList.hasOwnProperty(it)) {
                        resultList[it] = { "value": otherList[it],
                            "valueType": typeof otherList[it],
                            "isCommon": true };
                    }
                }
            } else {
                for (it in resultList) {
                    if (resultList.hasOwnProperty(it)) {
                        if (otherList.hasOwnProperty(it)) {
                            if (resultList[it].isCommon) {
                                resultList[it].isCommon = resultList[it].value === otherList[it];
                            }
                        } else {
                            delete resultList[it];
                        }
                    }
                }
            }
        };

        if (selectionLength > 0) {
            //get all attributes
            //get all registry elements
            i = selectionLength;
            while (--i >= 0) {
                cNode = this._client.getNode(this._ComponentID2GmeID[selectedObjIDs[i]]);

                flattenedAttrs = _getNodePropertyValues(cNode, "getAttributeNames", "getAttribute");

                _filterCommon(commonAttrs, flattenedAttrs, i === selectionLength - 1);

                flattenedRegs = _getNodePropertyValues(cNode, "getRegistryNames", "getRegistry");

                _filterCommon(commonRegs, flattenedRegs, i === selectionLength - 1);
            }

            _addItemsToResultList = function (srcList, prefix, dstList) {
                var i,
                    extKey,
                    keyParts;

                if (prefix !== "") {
                    prefix += ".";
                }

                for (i in srcList) {
                    if (srcList.hasOwnProperty(i)) {
                        extKey = prefix + i;
                        keyParts = i.split(".");
                        dstList[extKey] = { "name": keyParts[keyParts.length - 1],
                            "value": srcList[i].value,
                            "valueType": srcList[i].valueType};

                        if (i === "position.x" || i === "position.y") {
                            dstList[extKey].minValue = 0;
                            dstList[extKey].stepValue = 10;
                        }

                        if (srcList[i].isCommon === false) {
                            dstList[extKey].value = "";
                            dstList[extKey].options = {"textColor": noCommonValueColor};
                        }

                        if (extKey.indexOf(".x") > -1) {
                            //let's say its inherited, make it italic
                            dstList[extKey].options = dstList[extKey].options || {};
                            dstList[extKey].options.textItalic = true;
                            dstList[extKey].options.textBold = true;
                        }
                    }
                }
            };

            _addItemsToResultList(commonAttrs, "Attributes", propList);
            _addItemsToResultList(commonRegs, "Registry", propList);
        }

        return propList;
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onPropertyChanged = function (selectedObjIDs, args) {
        var i = selectedObjIDs.length,
            keyArr,
            setterFn,
            getterFn,
            propObject,
            propPointer,
            gmeID,
            path;

        this._client.startTransaction();
        while (--i >= 0) {
            gmeID = this._ComponentID2GmeID[selectedObjIDs[i]];

            keyArr = args.id.split(".");
            if (keyArr[0] === "Attributes") {
                setterFn = "setAttributes";
                getterFn = "getAttribute";
            } else {
                setterFn = "setRegistry";
                getterFn = "getRegistry";
            }

            keyArr.splice(0, 1);

            //get property object from node
            path = keyArr[0];
            propObject = this._client.getNode(gmeID)[getterFn](path);

            //get root object
            propPointer = propObject;
            keyArr.splice(0, 1);

            if(keyArr.length<1){
                //simple value so just set it
                propObject = args.newValue;
            } else {
                //dig down to leaf property
                while (keyArr.length > 1) {
                    propPointer = propPointer[keyArr[0]];
                    keyArr.splice(0, 1);
                }

                //set value
                propPointer[keyArr[0]] = args.newValue;
            }

            //save back object
            this._client[setterFn](gmeID, path, propObject);
        }
        this._client.completeTransaction();
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onBackgroundDroppableAccept = function (helper) {
        var metaInfo = helper.data("metaInfo");
        if (metaInfo) {
            if (metaInfo.hasOwnProperty(CONSTANTS.GME_ID)) {
                return true;
            }
        }

        return false;
    };

    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onBackgroundDrop = function (helper, position) {
        var metaInfo = helper.data("metaInfo"),
            intellyPasteOpts,
            gmeID;

        if (metaInfo) {
            if (metaInfo.hasOwnProperty(CONSTANTS.GME_ID)) {

                intellyPasteOpts = { "parentId": this.currentNodeInfo.id };

                gmeID = metaInfo[CONSTANTS.GME_ID];

                intellyPasteOpts[gmeID] = { "attributes": {}, registry: {} };
                intellyPasteOpts[gmeID].registry[nodePropertyNames.Registry.position] = { "x": position.x,
                                    "y": position.y };

                this._client.intellyPaste(intellyPasteOpts);
            }
        }
    };


    ModelEditorControlDiagramDesignerWidgetEventHandlers.prototype._onSelectionChanged = function (selectedIds) {
        var gmeIDs = [],
            len = selectedIds.length,
            id;

        while (len--) {
            id = this._ComponentID2GmeID[selectedIds[len]];
            if (id) {
                gmeIDs.push(id);
            }
        }

        //nobody is selected on the canvas
        //set the active selection to the opened guy
        if (gmeIDs.length === 0 && this.currentNodeInfo.id) {
            gmeIDs.push(this.currentNodeInfo.id);
        }

        if (gmeIDs.length !== 0) {
            this._client.setPropertyEditorIdList(gmeIDs);
        }
    };
    

    return ModelEditorControlDiagramDesignerWidgetEventHandlers;
});