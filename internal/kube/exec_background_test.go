package kube

import (
	"context"
	"io"
	"testing"

	"k8s.io/client-go/tools/remotecommand"
)

// fakeExecSession registers a session the manager can close without a
// stream behind it.
func fakeExecSession(m *ClientManager, id, contextName string) *execSession {
	ctx, cancel := context.WithCancel(context.Background())
	_, pw := io.Pipe()
	sess := &execSession{id: id, context: contextName, cancel: cancel, stdin: pw, resize: make(chan remotecommand.TerminalSize, 1)}
	m.execs.mu.Lock()
	m.execs.sessions[id] = sess
	m.execs.mu.Unlock()
	go func() { <-ctx.Done() }()
	return sess
}

func execSessionLive(m *ClientManager, id string) bool {
	m.execs.mu.Lock()
	defer m.execs.mu.Unlock()
	return m.execs.sessions[id] != nil
}

// A pod shell keeps running while the user switches to another cluster,
// which stops the watch of the one they leave.
func TestStopWatchKeepsExecSessions(t *testing.T) {
	m := NewClientManager()
	t.Cleanup(m.Shutdown)
	fakeExecSession(m, "exec-a", "ctx-a")

	m.StopWatch("ctx-a")

	if !execSessionLive(m, "exec-a") {
		t.Fatal("StopWatch closed an exec session; shells must survive a context switch")
	}
	m.StopExec("exec-a")
	if execSessionLive(m, "exec-a") {
		t.Fatal("StopExec left the session registered")
	}
}
