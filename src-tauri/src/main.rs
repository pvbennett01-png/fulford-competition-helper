#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Errors (offline, GitHub down etc.) are ignored — the app works as normal
                let _ = check_for_update(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// On startup: if a newer signed release is published, ask the user and install it
async fn check_for_update(app: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let Some(update) = app.updater()?.check().await? else { return Ok(()) };

    let message = format!(
        "A new version of Fulford Competition Helper is available.\n\n\
         Your version: {}\nNew version: {}\n\n\
         Install it now? The app will close and restart (takes under a minute).",
        update.current_version, update.version
    );
    let dialog = app
        .dialog()
        .message(message)
        .title("Update available")
        .buttons(MessageDialogButtons::OkCancelCustom("Install now".into(), "Later".into()));
    let install = tauri::async_runtime::spawn_blocking(move || dialog.blocking_show()).await?;
    if !install {
        return Ok(());
    }

    update.download_and_install(|_, _| {}, || {}).await?;
    app.restart();
}
