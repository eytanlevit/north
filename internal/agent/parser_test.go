package agent

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParse_AssistantEvent(t *testing.T) {
	input := `{"type":"assistant","subtype":"message","message":{"id":"msg_1","role":"assistant","content":[{"type":"text","text":"Hello"}],"model":"claude-sonnet-4-6","stop_reason":"end_turn"}}` + "\n"
	ch := Parse(strings.NewReader(input))
	event := <-ch
	require.NotNil(t, event)
	ae, ok := event.(AssistantEvent)
	require.True(t, ok)
	assert.Equal(t, "assistant", ae.EventType())
	assert.Equal(t, "msg_1", ae.Message.ID)
	assert.Len(t, ae.Message.Content, 1)
	assert.Equal(t, "Hello", ae.Message.Content[0].Text)
}

func TestParse_ContentBlockDelta(t *testing.T) {
	input := `{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"world"}}` + "\n"
	ch := Parse(strings.NewReader(input))
	event := <-ch
	require.NotNil(t, event)
	cbd, ok := event.(ContentBlockDelta)
	require.True(t, ok)
	assert.Equal(t, "content_block_delta", cbd.EventType())
	assert.Equal(t, 0, cbd.Index)
	assert.Equal(t, "world", cbd.Delta.Text)
}

func TestParse_ContentBlockStart(t *testing.T) {
	input := `{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}` + "\n"
	ch := Parse(strings.NewReader(input))
	event := <-ch
	require.NotNil(t, event)
	cbs, ok := event.(ContentBlockStart)
	require.True(t, ok)
	assert.Equal(t, "text", cbs.ContentBlock.Type)
}

func TestParse_ContentBlockStop(t *testing.T) {
	input := `{"type":"content_block_stop","index":0}` + "\n"
	ch := Parse(strings.NewReader(input))
	event := <-ch
	require.NotNil(t, event)
	_, ok := event.(ContentBlockStop)
	require.True(t, ok)
}

func TestParse_ResultEvent(t *testing.T) {
	input := `{"type":"result","result":{"type":"result","subtype":"success","duration_ms":3200,"cost_usd":0.04,"is_error":false}}` + "\n"
	ch := Parse(strings.NewReader(input))
	event := <-ch
	require.NotNil(t, event)
	re, ok := event.(ResultEvent)
	require.True(t, ok)
	assert.Equal(t, float64(3200), re.Result.Duration)
	assert.Equal(t, float64(0.04), re.Result.Cost)
	assert.False(t, re.Result.IsError)
}

func TestParse_SystemEvent(t *testing.T) {
	input := `{"type":"system","message":"Session started"}` + "\n"
	ch := Parse(strings.NewReader(input))
	event := <-ch
	require.NotNil(t, event)
	se, ok := event.(SystemEvent)
	require.True(t, ok)
	assert.Equal(t, "Session started", se.Message)
}

func TestParse_UnknownType(t *testing.T) {
	input := `{"type":"unknown_thing","data":"test"}` + "\n"
	ch := Parse(strings.NewReader(input))
	event := <-ch
	require.NotNil(t, event)
	raw, ok := event.(RawEvent)
	require.True(t, ok)
	assert.Equal(t, "unknown_thing", raw.Type)
}

func TestParse_EmptyLines(t *testing.T) {
	input := "\n\n" + `{"type":"system","message":"hi"}` + "\n\n"
	ch := Parse(strings.NewReader(input))
	event := <-ch
	require.NotNil(t, event)
	assert.Equal(t, "system", event.EventType())
	event = <-ch
	assert.Nil(t, event)
}

func TestParse_MalformedJSON(t *testing.T) {
	input := "not json\n" + `{"type":"system","message":"ok"}` + "\n"
	ch := Parse(strings.NewReader(input))
	event := <-ch
	require.NotNil(t, event)
	assert.Equal(t, "system", event.EventType())
}

func TestParse_MultipleEvents(t *testing.T) {
	input := `{"type":"system","message":"start"}` + "\n" +
		`{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}` + "\n" +
		`{"type":"result","result":{"type":"result","duration_ms":100,"cost_usd":0.01}}` + "\n"
	ch := Parse(strings.NewReader(input))
	var events []Event
	for e := range ch {
		events = append(events, e)
	}
	require.Len(t, events, 3)
	assert.Equal(t, "system", events[0].EventType())
	assert.Equal(t, "content_block_delta", events[1].EventType())
	assert.Equal(t, "result", events[2].EventType())
}

func TestParse_ToolUseContentBlock(t *testing.T) {
	input := `{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"tu_1","name":"Bash","input":{}}}` + "\n"
	ch := Parse(strings.NewReader(input))
	event := <-ch
	require.NotNil(t, event)
	cbs, ok := event.(ContentBlockStart)
	require.True(t, ok)
	assert.Equal(t, "tool_use", cbs.ContentBlock.Type)
	assert.Equal(t, "Bash", cbs.ContentBlock.Name)
}

func TestParse_ChannelCloses(t *testing.T) {
	input := `{"type":"system","message":"done"}` + "\n"
	ch := Parse(strings.NewReader(input))
	<-ch
	_, ok := <-ch
	assert.False(t, ok)
}
