package tui

import (
	"fmt"

	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/eytanlevit/north/internal/agent"
	"github.com/eytanlevit/north/internal/store"
)

type paneID int

const (
	paneChat paneID = iota
	paneBoard
)

// SessionModel is the root model for `north session`.
type SessionModel struct {
	chat          ChatModel
	app           AppModel
	store         store.Store
	agent         *agent.Agent
	focusedPane   paneID
	width         int
	height        int
	ready         bool
	initialPrompt string
	err           error
}

// NewSessionModel creates a new session model.
func NewSessionModel(s store.Store, initialPrompt string) SessionModel {
	return SessionModel{
		chat:          NewChatModel(),
		app:           New(s),
		store:         s,
		focusedPane:   paneChat,
		initialPrompt: initialPrompt,
	}
}

// RunSession starts the integrated session TUI.
func RunSession(s store.Store, initialPrompt string) error {
	m := NewSessionModel(s, initialPrompt)
	p := tea.NewProgram(m, tea.WithAltScreen())
	_, err := p.Run()
	return err
}

// Init initializes the session.
func (m SessionModel) Init() tea.Cmd {
	return tea.Batch(
		m.app.Init(),
		startAgentCmd(m.initialPrompt),
		m.chat.input.Focus(),
	)
}

// agentStartedMsg is sent when the agent process starts successfully.
type agentStartedMsg struct {
	agent *agent.Agent
}

// agentEventMsg wraps an event from the agent.
type agentEventMsg struct {
	event agent.Event
}

// agentDoneMsg is sent when the agent process exits.
type agentDoneMsg struct{}

// agentErrorMsg is sent when the agent fails to start.
type agentErrorMsg struct {
	err error
}

// startAgentCmd launches the Claude subprocess.
func startAgentCmd(prompt string) tea.Cmd {
	return func() tea.Msg {
		a, err := agent.Start(prompt)
		if err != nil {
			return agentErrorMsg{err: err}
		}
		return agentStartedMsg{agent: a}
	}
}

// agentListenCmd blocks on the event channel and returns one event.
func agentListenCmd(a *agent.Agent) tea.Cmd {
	return func() tea.Msg {
		event, ok := <-a.Events()
		if !ok {
			return agentDoneMsg{}
		}
		return agentEventMsg{event: event}
	}
}

// Update handles messages.
func (m SessionModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.ready = true

		chatWidth := msg.Width / 2
		boardWidth := msg.Width - chatWidth

		m.chat.SetSize(chatWidth, msg.Height-1)

		// Forward to app model with adjusted width
		appModel, cmd := m.app.Update(tea.WindowSizeMsg{
			Width:  boardWidth,
			Height: msg.Height - 1,
		})
		m.app = appModel.(AppModel)
		if cmd != nil {
			cmds = append(cmds, cmd)
		}
		return m, tea.Batch(cmds...)

	case agentStartedMsg:
		m.agent = msg.agent
		return m, agentListenCmd(m.agent)

	case agentErrorMsg:
		m.err = msg.err
		// Still show the board, just no agent
		return m, nil

	case agentEventMsg:
		m.chat.HandleEvent(msg.event)
		// Re-arm the listener
		return m, agentListenCmd(m.agent)

	case agentDoneMsg:
		m.agent = nil
		return m, nil

	case tea.KeyMsg:
		return m.handleKey(msg)
	}

	// Forward other messages to app model (config loaded, issues loaded, file changes, etc.)
	appModel, cmd := m.app.Update(msg)
	m.app = appModel.(AppModel)
	if cmd != nil {
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m SessionModel) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	// Global: ctrl+c quits
	if key.Matches(msg, sessionKeys.ForceQ) {
		if m.agent != nil {
			m.agent.Stop()
		}
		return m, tea.Quit
	}

	// Tab switches panes
	if key.Matches(msg, sessionKeys.Tab) {
		if m.focusedPane == paneChat {
			m.focusedPane = paneBoard
			m.chat.Blur()
		} else {
			m.focusedPane = paneChat
			m.chat.Focus()
		}
		return m, nil
	}

	if m.focusedPane == paneChat {
		return m.handleChatKey(msg)
	}

	// Forward to board
	appModel, cmd := m.app.Update(msg)
	m.app = appModel.(AppModel)
	return m, cmd
}

func (m SessionModel) handleChatKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	// Enter sends message
	if key.Matches(msg, sessionKeys.Send) {
		text := m.chat.InputValue()
		if text == "" {
			return m, nil
		}
		m.chat.AddUserMessage(text)
		m.chat.ResetInput()

		if m.agent != nil {
			m.agent.Send(text)
		}
		return m, nil
	}

	// Pass all other keys to textarea
	var cmd tea.Cmd
	m.chat.input, cmd = m.chat.input.Update(msg)
	return m, cmd
}

// View renders the session layout.
func (m SessionModel) View() string {
	if m.err != nil {
		return fmt.Sprintf("Agent error: %v\n\nPress ctrl+c to exit.", m.err)
	}

	if !m.ready {
		return "Loading..."
	}

	chatWidth := m.width / 2
	boardWidth := m.width - chatWidth

	// Build chat pane with border
	chatStyle := sessionPaneStyle.Width(chatWidth - 2).Height(m.height - 3)
	boardStyle := sessionPaneStyle.Width(boardWidth - 2).Height(m.height - 3)

	if m.focusedPane == paneChat {
		chatStyle = chatStyle.BorderForeground(colorFocusBdr)
	}
	if m.focusedPane == paneBoard {
		boardStyle = boardStyle.BorderForeground(colorFocusBdr)
	}

	chatView := chatStyle.Render(m.chat.View())
	boardView := boardStyle.Render(m.app.View())

	main := lipgloss.JoinHorizontal(lipgloss.Top, chatView, boardView)

	// Status bar
	status := helpStyle.Render("tab switch pane  ? help  ctrl+c quit")

	return main + "\n" + status
}
