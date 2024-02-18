# 🔍 Copilot for Obsidian

This is a hardfork from https://github.com/logancyang/obsidian-copilot

I will try to merge from upstream to a certain extent for a while, but their codestyle is atrocious and unmaintainable. <br>
Previous owner doesn't seem to care about the features I need and [refuses](https://github.com/logancyang/obsidian-copilot/issues/208#issuecomment-1889777109) to collaborate giving obscure reasons.

Also the original repo is basically malware, automatically indexing the vault (although using cheap embeddings)
and [not being frugal](https://github.com/logancyang/obsidian-copilot/blob/848d2974348c9de955b52aadc1d3fbb9ab8cb6de/src/utils.ts#L138) to LLM calls in general.

This is not acceptable for any OSS, thus the necessity for a hardfork.

# Installation

For now the plugin is not published to obsidian community. This will be done later.

- Pick the release you want to install
- Download `copilot.zip`
- Open obsidian → Settings → Community Plugins → Installed Plugins → Press on the explorer button
- Unpack the `copilot.zip` in a new directory, for example named `copilot`
- Press the reload button in the obsidian

# Main differences for now:

- Supports actual chat with prompt by stuffing the prompt into
- Correct tag detection (does not detect tags defined by hashtag in upstream for whatever reason)
- There is an option to edit existing messages, that will reprompt LLM without losing previous context. (contexted messages cannot be edited for now)

# Roadmap:

- [x] Add dumb configurable context (tags)
- [ ] Get familiar with the code
- [ ] Get a major refactoring in (rm singletons, extract classes, reactify the bad code)
- [ ] Create agent mode for context
- [ ] Register obsidian-commands for agent mode (read documents by path list)
