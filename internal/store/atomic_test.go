package store

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAtomicWriteFile_Success(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.txt")
	data := []byte("hello world")

	err := AtomicWriteFile(path, data, 0644)
	require.NoError(t, err)

	got, err := os.ReadFile(path)
	require.NoError(t, err)
	assert.Equal(t, data, got)
}

func TestAtomicWriteFile_Permissions(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.txt")

	err := AtomicWriteFile(path, []byte("data"), 0600)
	require.NoError(t, err)

	info, err := os.Stat(path)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0600), info.Mode().Perm())
}

func TestAtomicWriteFile_OverwriteExisting(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.txt")

	require.NoError(t, os.WriteFile(path, []byte("original"), 0644))

	err := AtomicWriteFile(path, []byte("replaced"), 0644)
	require.NoError(t, err)

	got, err := os.ReadFile(path)
	require.NoError(t, err)
	assert.Equal(t, []byte("replaced"), got)
}

func TestAtomicWriteFile_NonExistentDirectory(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nonexistent", "test.txt")

	err := AtomicWriteFile(path, []byte("data"), 0644)
	assert.Error(t, err)
}

func TestAtomicWriteFile_EmptyData(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "empty.txt")

	err := AtomicWriteFile(path, []byte{}, 0644)
	require.NoError(t, err)

	got, err := os.ReadFile(path)
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestAtomicWriteFile_LargeData(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "large.txt")
	data := []byte(strings.Repeat("x", 1<<20)) // 1MB

	err := AtomicWriteFile(path, data, 0644)
	require.NoError(t, err)

	got, err := os.ReadFile(path)
	require.NoError(t, err)
	assert.Equal(t, len(data), len(got))
}

func TestAtomicWriteFile_NoTempLeftover(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.txt")

	require.NoError(t, AtomicWriteFile(path, []byte("data"), 0644))

	entries, err := os.ReadDir(dir)
	require.NoError(t, err)
	assert.Len(t, entries, 1, "should only have the target file, no temp leftovers")
}
