mod commands;

use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::WebviewWindowBuilder;
use tauri::{
    menu::{Menu, MenuItem},
    Emitter, Manager,
};

#[tauri::command]
fn open_dashboard(app: tauri::AppHandle, url: String, title: String) -> Result<(), String> {
    // Check if dashboard window already exists
    if let Some(window) = app.get_webview_window("dashboard") {
        let _ = window.show();
        let _ = window.set_focus();
        // Navigate to new URL
        let parsed: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
        let _ = window.navigate(parsed);
        return Ok(());
    }

    let parsed: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;

    WebviewWindowBuilder::new(&app, "dashboard", tauri::WebviewUrl::External(parsed))
        .title(&title)
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // ── System Tray ──────────────────────────────────────
            let show = MenuItem::with_id(app, "show", "Show Studio", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Hide to Tray", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

            let _tray = TrayIconBuilder::new()
                .tooltip("LiveClaw Studio")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                    "quit" => {
                        // Kill bundled OBS before quitting
                        app.emit("app-quit", ()).ok();
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Minimize to tray on close instead of quitting
            if let Some(window) = app.get_webview_window("main") {
                let w = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = w.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::obs::detect_obs,
            commands::obs::launch_obs,
            commands::obs::ensure_obs_ready,
            commands::obs_portable::check_obs_portable,
            commands::obs_portable::setup_obs_portable,
            commands::obs_portable::launch_bundled_obs,
            commands::obs_portable::kill_obs_process,
            commands::ffmpeg::detect_ffmpeg,
            commands::ffmpeg::start_ffmpeg_stream,
            commands::ffmpeg::stop_ffmpeg_stream,
            commands::ffmpeg::ffmpeg_screenshot,
            commands::runtime::start_agent_runtime,
            commands::runtime::stop_agent_runtime,
            commands::keychain::store_token,
            commands::keychain::get_token,
            commands::keychain::clear_token,
            open_dashboard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LiveClaw Studio");
}
