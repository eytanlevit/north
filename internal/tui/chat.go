package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	"github.com/eytanlevit/north/internal/agent"
)

type chatMessage struct {
	role    string // "user", "assistant", "tool", "result", "error"
	content string
}

// ChatModel handles the agent chat pane.
type ChatModel struct {
	messages    []chatMessage
	viewport    viewport.Model
	input       textarea.Model
	width       int
	height      int
	ready       bool
	streaming   bool            // true while receiving content_block_deltas
	currentText strings.Builder // accumulates streaming text
}

// NewChatModel creates a new chat model.
func NewChatModel() ChatModel {
	ti := textarea.New()
	ti.Placeholder = "Type a message..."
	ti.CharLimit = 4096
	ti.SetHeight(3)
	ti.ShowLineNumbers = false
	ti.Focus()

	return ChatModel{
		input: ti,
	}
}

// SetSize updates the chat pane dimensions.
func (c *ChatModel) SetSize(w, h int) {
	c.width = w
	c.height = h

	inputHeight := 5 // textarea + borders
	vpHeight := max(1, h-inputHeight-1)
	vpWidth := max(1, w-2)

	if !c.ready {
		c.viewport = viewport.New(vpWidth, vpHeight)
		c.ready = true
	} else {
		c.viewport.Width = vpWidth
		c.viewport.Height = vpHeight
	}
	c.input.SetWidth(w - 2)

	c.rebuildContent()
}

// HandleEvent processes an agent event and updates the chat.
func (c *ChatModel) HandleEvent(event agent.Event) {
	switch e := event.(type) {
	case agent.ContentBlockStart:
		if e.ContentBlock.Type == "tool_use" {
			// Flush any accumulated text
			c.flushStreaming()
			name := e.ContentBlock.Name
			c.messages = append(c.messages, chatMessage{
				role:    "tool",
				content: fmt.Sprintf("⚡ %s", name),
			})
		} else if e.ContentBlock.Type == "text" {
			c.streaming = true
			c.currentText.Reset()
		}

	case agent.ContentBlockDelta:
		if c.streaming && e.Delta.Text != "" {
			c.currentText.WriteString(e.Delta.Text)
			// Update the viewport with partial text for live streaming
			c.rebuildContent()
			return // skip double rebuild
		}

	case agent.ContentBlockStop:
		c.flushStreaming()

	case agent.AssistantEvent:
		// Full message (non-streaming fallback)
		for _, block := range e.Message.Content {
			switch block.Type {
			case "text":
				if block.Text != "" {
					c.messages = append(c.messages, chatMessage{role: "assistant", content: block.Text})
				}
			case "tool_use":
				inputStr := fmt.Sprintf("%v", block.Input)
				c.messages = append(c.messages, chatMessage{
					role:    "tool",
					content: fmt.Sprintf("⚡ %s: %s", block.Name, inputStr),
				})
			}
		}

	case agent.ResultEvent:
		dur := e.Result.Duration / 1000
		cost := e.Result.Cost
		if e.Result.IsError {
			c.messages = append(c.messages, chatMessage{
				role:    "error",
				content: fmt.Sprintf("✗ Error (%.1fs, $%.2f)", dur, cost),
			})
		} else {
			c.messages = append(c.messages, chatMessage{
				role:    "result",
				content: fmt.Sprintf("✓ Completed (%.1fs, $%.2f)", dur, cost),
			})
		}

	case agent.SystemEvent:
		if e.Message != "" {
			c.messages = append(c.messages, chatMessage{role: "assistant", content: e.Message})
		}
	}

	c.rebuildContent()
}

func (c *ChatModel) flushStreaming() {
	if c.streaming {
		text := strings.TrimSpace(c.currentText.String())
		if text != "" {
			c.messages = append(c.messages, chatMessage{role: "assistant", content: text})
		}
		c.streaming = false
		c.currentText.Reset()
	}
}

// AddUserMessage adds a user message to the chat.
func (c *ChatModel) AddUserMessage(msg string) {
	c.messages = append(c.messages, chatMessage{role: "user", content: msg})
	c.rebuildContent()
}

// InputValue returns the current input text.
func (c *ChatModel) InputValue() string {
	return c.input.Value()
}

// ResetInput clears the input field.
func (c *ChatModel) ResetInput() {
	c.input.Reset()
}

// Focus gives focus to the input.
func (c *ChatModel) Focus() {
	c.input.Focus()
}

// Blur removes focus from the input.
func (c *ChatModel) Blur() {
	c.input.Blur()
}

func (c *ChatModel) rebuildContent() {
	if !c.ready {
		return
	}

	contentWidth := max(1, c.width-4)
	var b strings.Builder

	for _, msg := range c.messages {
		switch msg.role {
		case "user":
			styled := chatUserStyle.Width(contentWidth).Render("> " + msg.content)
			b.WriteString(styled + "\n")
		case "assistant":
			b.WriteString(wordWrap(msg.content, contentWidth) + "\n")
		case "tool":
			styled := chatToolStyle.Width(contentWidth).Render(msg.content)
			b.WriteString(styled + "\n")
		case "result":
			styled := chatResultStyle.Width(contentWidth).Render(msg.content)
			b.WriteString(styled + "\n")
		case "error":
			styled := chatErrorStyle.Width(contentWidth).Render(msg.content)
			b.WriteString(styled + "\n")
		}
	}

	// Show streaming text in progress
	if c.streaming {
		text := c.currentText.String()
		if text != "" {
			b.WriteString(wordWrap(text, contentWidth))
		}
	}

	c.viewport.SetContent(b.String())
	c.viewport.GotoBottom()
}

// View renders the chat pane.
func (c *ChatModel) View() string {
	if !c.ready {
		return "Loading chat..."
	}

	return c.viewport.View() + "\n" + c.input.View()
}
