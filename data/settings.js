module.exports = {
    editorTheme: {
        projects: {
            enabled: false // must be configured for the "node-red-contrib-flow-manager"package
        }
    },
    contextStorage: {
        memory: { module: "memory" },
        file: {
            module: "localfilesystem",
            config: {
                dir: "/data/bridge-files",
                flushInterval: 5
            }
        }
    }
}

