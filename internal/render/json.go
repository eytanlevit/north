package render

import (
	"encoding/json"
	"fmt"
	"io"
)

// JSON writes v as indented JSON to w.
func JSON(w io.Writer, v any) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	return enc.Encode(v)
}

// JSONError writes a structured error as JSON to w.
func JSONError(w io.Writer, err error, exitCode int) {
	out := map[string]any{
		"error": err.Error(),
		"code":  exitCode,
	}
	data, _ := json.MarshalIndent(out, "", "  ")
	fmt.Fprintln(w, string(data))
}

// TextError writes a plain-text error message to w.
func TextError(w io.Writer, err error) {
	fmt.Fprintf(w, "Error: %s\n", err)
}
