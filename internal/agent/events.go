package agent

// Event is the common interface for all stream events.
type Event interface {
	EventType() string
}

// RawEvent holds the raw JSON envelope before type dispatch.
type RawEvent struct {
	Type      string `json:"type"`
	Subtype   string `json:"subtype,omitempty"`
	SessionID string `json:"session_id,omitempty"`
}

func (e RawEvent) EventType() string { return e.Type }

// AssistantEvent represents assistant message output.
type AssistantEvent struct {
	RawEvent
	Message struct {
		ID         string         `json:"id"`
		Role       string         `json:"role"`
		Content    []ContentBlock `json:"content"`
		Model      string         `json:"model"`
		StopReason string         `json:"stop_reason"`
	} `json:"message"`
}

func (e AssistantEvent) EventType() string { return "assistant" }

// ContentBlock is a piece of content in a message.
type ContentBlock struct {
	Type  string      `json:"type"`
	Text  string      `json:"text,omitempty"`
	ID    string      `json:"id,omitempty"`
	Name  string      `json:"name,omitempty"`
	Input interface{} `json:"input,omitempty"`
}

// ContentBlockStart signals a new content block starting.
type ContentBlockStart struct {
	RawEvent
	Index        int          `json:"index"`
	ContentBlock ContentBlock `json:"content_block"`
}

func (e ContentBlockStart) EventType() string { return "content_block_start" }

// ContentBlockDelta represents partial streaming content.
type ContentBlockDelta struct {
	RawEvent
	Index int `json:"index"`
	Delta struct {
		Type string `json:"type"`
		Text string `json:"text,omitempty"`
	} `json:"delta"`
}

func (e ContentBlockDelta) EventType() string { return "content_block_delta" }

// ContentBlockStop signals a content block is complete.
type ContentBlockStop struct {
	RawEvent
	Index int `json:"index"`
}

func (e ContentBlockStop) EventType() string { return "content_block_stop" }

// ResultEvent is the final result when the agent completes.
type ResultEvent struct {
	RawEvent
	Result struct {
		Type     string  `json:"type"`
		Subtype  string  `json:"subtype"`
		Duration float64 `json:"duration_ms"`
		Cost     float64 `json:"cost_usd"`
		IsError  bool    `json:"is_error"`
		Message  string  `json:"result,omitempty"`
	} `json:"result"`
}

func (e ResultEvent) EventType() string { return "result" }

// SystemEvent represents system-level messages.
type SystemEvent struct {
	RawEvent
	Message string `json:"message,omitempty"`
}

func (e SystemEvent) EventType() string { return "system" }
