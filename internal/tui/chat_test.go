package tui

import (
	"testing"

	"github.com/eytanlevit/north/internal/agent"
	"github.com/stretchr/testify/assert"
)

func TestChatModel_AddUserMessage(t *testing.T) {
	chat := NewChatModel()
	chat.SetSize(80, 30)

	chat.AddUserMessage("hello")
	assert.Len(t, chat.messages, 1)
	assert.Equal(t, "user", chat.messages[0].role)
	assert.Equal(t, "hello", chat.messages[0].content)
}

func TestChatModel_HandleAssistantEvent(t *testing.T) {
	chat := NewChatModel()
	chat.SetSize(80, 30)

	event := agent.AssistantEvent{}
	event.Message.Content = []agent.ContentBlock{
		{Type: "text", Text: "Hello world"},
	}
	chat.HandleEvent(event)

	assert.Len(t, chat.messages, 1)
	assert.Equal(t, "assistant", chat.messages[0].role)
	assert.Equal(t, "Hello world", chat.messages[0].content)
}

func TestChatModel_HandleToolUse(t *testing.T) {
	chat := NewChatModel()
	chat.SetSize(80, 30)

	event := agent.ContentBlockStart{}
	event.ContentBlock = agent.ContentBlock{Type: "tool_use", Name: "Bash"}
	chat.HandleEvent(event)

	assert.Len(t, chat.messages, 1)
	assert.Equal(t, "tool", chat.messages[0].role)
	assert.Contains(t, chat.messages[0].content, "Bash")
}

func TestChatModel_HandleStreamingText(t *testing.T) {
	chat := NewChatModel()
	chat.SetSize(80, 30)

	// Start text block
	start := agent.ContentBlockStart{}
	start.ContentBlock = agent.ContentBlock{Type: "text"}
	chat.HandleEvent(start)
	assert.True(t, chat.streaming)

	// Stream deltas
	delta1 := agent.ContentBlockDelta{}
	delta1.Delta.Type = "text_delta"
	delta1.Delta.Text = "Hello "
	chat.HandleEvent(delta1)

	delta2 := agent.ContentBlockDelta{}
	delta2.Delta.Type = "text_delta"
	delta2.Delta.Text = "world"
	chat.HandleEvent(delta2)

	// Stop block
	stop := agent.ContentBlockStop{}
	chat.HandleEvent(stop)

	assert.False(t, chat.streaming)
	assert.Len(t, chat.messages, 1)
	assert.Equal(t, "assistant", chat.messages[0].role)
	assert.Equal(t, "Hello world", chat.messages[0].content)
}

func TestChatModel_HandleResult(t *testing.T) {
	chat := NewChatModel()
	chat.SetSize(80, 30)

	event := agent.ResultEvent{}
	event.Result.Duration = 3200
	event.Result.Cost = 0.04
	chat.HandleEvent(event)

	assert.Len(t, chat.messages, 1)
	assert.Equal(t, "result", chat.messages[0].role)
	assert.Contains(t, chat.messages[0].content, "Completed")
	assert.Contains(t, chat.messages[0].content, "3.2s")
}

func TestChatModel_HandleErrorResult(t *testing.T) {
	chat := NewChatModel()
	chat.SetSize(80, 30)

	event := agent.ResultEvent{}
	event.Result.IsError = true
	event.Result.Duration = 1000
	event.Result.Cost = 0.01
	chat.HandleEvent(event)

	assert.Len(t, chat.messages, 1)
	assert.Equal(t, "error", chat.messages[0].role)
	assert.Contains(t, chat.messages[0].content, "Error")
}

func TestChatModel_HandleSystemEvent(t *testing.T) {
	chat := NewChatModel()
	chat.SetSize(80, 30)

	event := agent.SystemEvent{Message: "System initialized"}
	chat.HandleEvent(event)

	assert.Len(t, chat.messages, 1)
	assert.Equal(t, "assistant", chat.messages[0].role)
	assert.Equal(t, "System initialized", chat.messages[0].content)
}

func TestChatModel_HandleSystemEvent_Empty(t *testing.T) {
	chat := NewChatModel()
	chat.SetSize(80, 30)

	event := agent.SystemEvent{Message: ""}
	chat.HandleEvent(event)

	assert.Len(t, chat.messages, 0)
}

func TestChatModel_View(t *testing.T) {
	chat := NewChatModel()
	chat.SetSize(80, 30)

	chat.AddUserMessage("test prompt")
	view := chat.View()
	assert.Contains(t, view, "test prompt")
}

func TestChatModel_View_NotReady(t *testing.T) {
	chat := NewChatModel()
	view := chat.View()
	assert.Contains(t, view, "Loading chat...")
}

func TestChatModel_FlushStreamingOnToolUse(t *testing.T) {
	chat := NewChatModel()
	chat.SetSize(80, 30)

	// Start text streaming
	start := agent.ContentBlockStart{}
	start.ContentBlock = agent.ContentBlock{Type: "text"}
	chat.HandleEvent(start)

	delta := agent.ContentBlockDelta{}
	delta.Delta.Text = "partial text"
	chat.HandleEvent(delta)

	// Stop the text block
	stop := agent.ContentBlockStop{}
	chat.HandleEvent(stop)

	// Then tool use arrives
	toolStart := agent.ContentBlockStart{}
	toolStart.ContentBlock = agent.ContentBlock{Type: "tool_use", Name: "Read"}
	chat.HandleEvent(toolStart)

	assert.Len(t, chat.messages, 2)
	assert.Equal(t, "assistant", chat.messages[0].role)
	assert.Equal(t, "partial text", chat.messages[0].content)
	assert.Equal(t, "tool", chat.messages[1].role)
}
