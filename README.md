# Parat-Bridge

A Node-RED based bidirectional integration bridge for disaster management systems, developed by ParatAI.


## Description

Parat-Bridge enables near real-time communication between disaster management and tactical communication systems. Currently bridging Rayvn and WaSOS, the platform is designed with extensibility in mind to support additional system integrations in the future.


The bridge:

- Polls connected systems for new entries and forwards them across platforms
- Handles authentication and session management for connected systems
- Monitors connection health and sends alerts on sustained failures


## Quick Start

1. Install [Docker Desktop](https://docs.docker.com/desktop/)
2. Clone the repository
3. Run `docker compose up -d` in the `Parat-Bridge` folder
4. Open `http://localhost:1880`
5. Configure Rayvn and WaSOS credentials in the Parat-Bridge UI

## Documentation

For detailed guides, see the [Wiki](https://github.com/Gruppe10UIA/Parat-Bridge/wiki):

| Document | Description |
|----------|-------------|
| [First Time Setup](https://github.com/Gruppe10UIA/Parat-Bridge/wiki/first-time-setup) | Getting started guide |
| [Git Workflow](https://github.com/Gruppe10UIA/Parat-Bridge/wiki/git-workflow) | Branch and commit guidelines |
| [Docker Guide](https://github.com/Gruppe10UIA/Parat-Bridge/wiki/docker-guide) | Container commands and configuration |
| [Dependencies](https://github.com/Gruppe10UIA/Parat-Bridge/wiki/dependencies) | Managing Node-RED packages |
| [Environment Configuration](https://github.com/Gruppe10UIA/Parat-Bridge/wiki/environment-configuration) | Settings and ports |
| [Project Structure](https://github.com/Gruppe10UIA/Parat-Bridge/wiki/included-files-and-directories) | Files and directories overview |
| [Error Handling](https://github.com/Gruppe10UIA/Parat-Bridge/wiki/error-handling) | Error monitoring and alerting |

## Tech Stack

- [Node-RED](https://nodered.org/) - Flow-based programming platform
- [Docker](https://www.docker.com/) - Containerization
- [Rayvn](https://rayvn.global/) - Incident management platform
- [WaSOS](https://wasos.no/) - Tactical communication system
- [FFmpeg](https://ffmpeg.org/) - Media processing (installed in the docker container)
## Team

ParatAI
