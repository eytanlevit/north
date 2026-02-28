package agent

import (
	"bufio"
	"encoding/json"
	"io"
)

// Parse reads newline-delimited JSON from r and sends parsed events on the returned channel.
// The channel is closed when the reader is exhausted.
func Parse(r io.Reader) <-chan Event {
	ch := make(chan Event, 64)
	go func() {
		defer close(ch)
		scanner := bufio.NewScanner(r)
		scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024)
		for scanner.Scan() {
			line := scanner.Bytes()
			if len(line) == 0 {
				continue
			}

			var raw RawEvent
			if err := json.Unmarshal(line, &raw); err != nil {
				continue
			}

			var event Event
			switch raw.Type {
			case "assistant":
				var e AssistantEvent
				if json.Unmarshal(line, &e) == nil {
					event = e
				}
			case "content_block_start":
				var e ContentBlockStart
				if json.Unmarshal(line, &e) == nil {
					event = e
				}
			case "content_block_delta":
				var e ContentBlockDelta
				if json.Unmarshal(line, &e) == nil {
					event = e
				}
			case "content_block_stop":
				var e ContentBlockStop
				if json.Unmarshal(line, &e) == nil {
					event = e
				}
			case "result":
				var e ResultEvent
				if json.Unmarshal(line, &e) == nil {
					event = e
				}
			case "system":
				var e SystemEvent
				if json.Unmarshal(line, &e) == nil {
					event = e
				}
			default:
				event = raw
			}

			if event != nil {
				ch <- event
			}
		}
	}()
	return ch
}
