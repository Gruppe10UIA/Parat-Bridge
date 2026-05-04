module.exports = {
    functionExternalModules: true,
    editorTheme: {
        projects: {
            enabled: false // must be configured for the "node-red-contrib-flow-manager"package
        }
    },
    contextStorage: {
        default: {
            module: require("/data/custom-scripts/context-store")
        }
    },
    uibuilder: {
        uibRoot: '/data/uibuilder'
    }
}
