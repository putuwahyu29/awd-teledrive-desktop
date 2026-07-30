package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path"
	"reflect"
	"strings"
	"syscall"
	"time"
)

type HeadlessServer struct {
	app    *App
	host   string
	port   int
	apiKey string
}

func NewHeadlessServer(app *App, host string, port int, apiKey string) *HeadlessServer {
	return &HeadlessServer{
		app:    app,
		host:   host,
		port:   port,
		apiKey: apiKey,
	}
}

func (hs *HeadlessServer) Start() error {
	hs.app.isHeadless = true
	hs.app.headlessPort = hs.port

	// Inisialisasi App backend jika belum
	hs.app.startup(context.Background())

	mux := http.NewServeMux()

	// Auth Middleware
	authWrapper := func(handler http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if hs.apiKey != "" {
				clientKey := r.Header.Get("X-API-Key")
				if clientKey == "" {
					bearer := r.Header.Get("Authorization")
					if strings.HasPrefix(bearer, "Bearer ") {
						clientKey = strings.TrimPrefix(bearer, "Bearer ")
					}
				}
				if clientKey == "" {
					clientKey = r.URL.Query().Get("api_key")
				}
				if clientKey != hs.apiKey {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusUnauthorized)
					_ = json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized: invalid or missing API Key"})
					return
				}
			}
			handler(w, r)
		}
	}

	// Health check endpoint
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "ok",
			"app":     "Awd TeleDrive",
			"mode":    "headless",
			"time":    time.Now().Unix(),
			"version": AppVersion,
		})
	})

	// Generic Dynamic Reflection Handler for any /api/MethodName API call
	mux.HandleFunc("/api/", authWrapper(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		methodName := strings.TrimPrefix(r.URL.Path, "/api/")
		if methodName == "" {
			http.NotFound(w, r)
			return
		}

		appVal := reflect.ValueOf(hs.app)
		method := appVal.MethodByName(methodName)
		if !method.IsValid() {
			http.NotFound(w, r)
			return
		}

		var rawArgs []json.RawMessage
		if r.Body != nil {
			bodyBytes, err := io.ReadAll(r.Body)
			if err == nil && len(bodyBytes) > 0 {
				_ = json.Unmarshal(bodyBytes, &rawArgs)
			}
		}

		mType := method.Type()
		numIn := mType.NumIn()
		inArgs := make([]reflect.Value, numIn)

		for i := 0; i < numIn; i++ {
			inType := mType.In(i)
			val := reflect.New(inType).Elem()
			if i < len(rawArgs) {
				_ = json.Unmarshal(rawArgs[i], val.Addr().Interface())
			}
			inArgs[i] = val
		}

		results := method.Call(inArgs)

		if len(results) == 0 {
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
			return
		}

		var errVal error
		lastRes := results[len(results)-1]
		if lastRes.Type().Implements(reflect.TypeOf((*error)(nil)).Elem()) {
			if !lastRes.IsNil() {
				errVal = lastRes.Interface().(error)
			}
		}

		if errVal != nil {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": errVal.Error()})
			return
		}

		if len(results) == 1 {
			if results[0].Type().Implements(reflect.TypeOf((*error)(nil)).Elem()) {
				_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
			} else {
				_ = json.NewEncoder(w).Encode(results[0].Interface())
			}
		} else if len(results) >= 2 {
			_ = json.NewEncoder(w).Encode(results[0].Interface())
		} else {
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		}
	}))

	// Serve Frontend Static Assets with SPA fallback
	subFS, err := fs.Sub(assets, "frontend/dist")
	if err == nil {
		fileServer := http.FileServer(http.FS(subFS))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")

			if strings.HasPrefix(r.URL.Path, "/api/") {
				http.NotFound(w, r)
				return
			}
			// Check if file exists in static assets, if not fallback to index.html for SPA
			upath := r.URL.Path
			if !strings.HasPrefix(upath, "/") {
				upath = "/" + upath
			}
			upath = path.Clean(upath)
			f, openErr := subFS.Open(strings.TrimPrefix(upath, "/"))
			if openErr != nil {
				r.URL.Path = "/"
			} else {
				_ = f.Close()
			}
			fileServer.ServeHTTP(w, r)
		})
	}

	addr := fmt.Sprintf("%s:%d", hs.host, hs.port)
	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	log.Printf("==================================================")
	log.Printf("  Awd TeleDrive Headless Web Server active!")
	log.Printf("  Listening on: http://%s", addr)
	if hs.apiKey != "" {
		log.Printf("  API Key protection: ENABLED")
	} else {
		log.Printf("  API Key protection: DISABLED (Public)")
	}
	log.Printf("==================================================")

	// Graceful Shutdown signal handler
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	<-stop
	log.Println("Shutting down Awd TeleDrive Headless Web Server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	hs.app.shutdown(ctx)

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced shutdown error: %v", err)
	}

	log.Println("Server gracefully stopped.")
	return nil
}
