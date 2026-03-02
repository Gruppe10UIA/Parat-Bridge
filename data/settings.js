module.exports = {
    editorTheme: {
        projects: {
            enabled: false // must be configured for the "node-red-contrib-flow-manager"package
        }
    },
    contextStorage: {
        default: {
            module: "localfilesystem",
            config: {
                dir: "/data/bridge-files",
                flushInterval: 1
            }
        }
    }
}
