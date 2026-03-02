# PMTUI

## What PMTUI Does

**PMTUI** is a **terminal-based (TUI) project management tool** that combines:

1. **AI-Powered Chat Interface** (left pane - 30%)
   - Powered by Claude (Anthropic's Opus model)
   - AI agent that can manage your project through natural conversation
   - Session persistence - resumes previous conversations
   - Streaming responses with real-time tool execution feedback

2. **Issue Tracker** (right pane - 70%)
   - Grouped issue list with customizable status columns (todo → in-progress → done)
   - Color-coded priority levels (high/medium/low)
   - Keyboard navigation & mouse scroll support
   - Click to view issue details in overlays

3. **AI Agent Capabilities**
   - Create, update, delete, and list issues through chat
   - Ask clarifying questions before creating issues
   - Explore the codebase (read, grep, find files)
   - Manage issue relationships (parent issues, blockers)
   - Add comments and labels to issues
   - Execute bash commands safely
   - Analyze code to create technically-informed issues

4. **CLI Interface (for Coding Agents)**
   - Command-line tool for coding agents to fetch issues and use as prompts
   - Agents can update issue status as they work (todo → in-progress → done)
   - Scriptable workflows for agent automation
   - Enables coding agents to self-manage their work queue

5. **Storage & Structure**
   - Issues stored as markdown files with YAML frontmatter (`.pm/issues/`)
   - Configuration in `.pm/config.yaml`
   - Project notes in `.pm/project.md`
   - Session logs saved to `.pm/chats/`

6. **Built With**
   - TypeScript
   - pi-agent-core, pi-ai, pi-coding-agent (AI framework)
   - pi-tui (terminal UI framework)
