package update

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCompare(t *testing.T) {
	cases := []struct {
		name      string
		current   string
		tag       string
		available bool
	}{
		{"minor newer", "v0.15.0", "v0.16.0", true},
		{"equal", "v0.16.0", "v0.16.0", false},
		{"latest older", "v0.16.0", "v0.15.0", false},
		{"patch newer", "v0.16.0", "v0.16.1", true},
		{"prerelease upgrades to release", "v0.16.0-rc1", "v0.16.0", true},
		{"release over prerelease tag", "v0.16.0", "v0.16.0-rc1", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res, err := compare(tc.current, githubRelease{TagName: tc.tag, HTMLURL: "https://example/r"})
			if err != nil {
				t.Fatalf("compare: %v", err)
			}
			if res.Available != tc.available {
				t.Errorf("available: got %v, want %v", res.Available, tc.available)
			}
			if res.Latest != tc.tag {
				t.Errorf("latest: got %q, want %q", res.Latest, tc.tag)
			}
		})
	}
}

func TestCompareRejectsUnparseableTag(t *testing.T) {
	if _, err := compare("v0.16.0", githubRelease{TagName: "not-a-version"}); err == nil {
		t.Fatal("expected an error for an unparseable tag")
	}
}

func TestCheckDevSkipsNetwork(t *testing.T) {
	prev := apiBaseURL
	t.Cleanup(func() { apiBaseURL = prev })
	srv := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Error("dev build must not call the releases API")
	}))
	t.Cleanup(srv.Close)
	apiBaseURL = srv.URL

	for _, v := range []string{"dev", "dev-abc1234", ""} {
		res, err := Check(context.Background(), v, "owner", "repo")
		if err != nil {
			t.Fatalf("Check(%q): %v", v, err)
		}
		if res.Available {
			t.Errorf("Check(%q): dev build should never report an update", v)
		}
	}
}

func TestCheckFetchesLatest(t *testing.T) {
	prev := apiBaseURL
	t.Cleanup(func() { apiBaseURL = prev })
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got, want := r.URL.Path, "/repos/owner/repo/releases/latest"; got != want {
			t.Errorf("path: got %q, want %q", got, want)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"tag_name":"v0.17.0","html_url":"https://example/releases/v0.17.0","body":"notes","published_at":"2026-05-27T00:00:00Z"}`))
	}))
	t.Cleanup(srv.Close)
	apiBaseURL = srv.URL

	res, err := Check(context.Background(), "v0.16.0", "owner", "repo")
	if err != nil {
		t.Fatalf("Check: %v", err)
	}
	if !res.Available {
		t.Error("expected an update to be available")
	}
	if res.Latest != "v0.17.0" || res.ReleaseURL != "https://example/releases/v0.17.0" {
		t.Errorf("unexpected result: %+v", res)
	}
}
