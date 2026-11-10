package com.aslikaata.customer;

import android.Manifest;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/**
 * Keep Firebase configuration failures on the Capacitor error path instead of
 * allowing an uncaught native exception to terminate the app.
 */
@CapacitorPlugin(
    name = "PushNotifications",
    permissions = @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "receive")
)
public class SafePushNotificationsPlugin extends PushNotificationsPlugin {
    @Override
    @PluginMethod
    public void register(PluginCall call) {
        try {
            super.register(call);
        } catch (IllegalStateException exception) {
            String message = "Push registration unavailable. Check this app's Firebase google-services.json configuration.";
            sendError(message);
            call.reject(message, "FIREBASE_NOT_CONFIGURED", exception);
        }
    }

    @Override
    @PluginMethod
    public void unregister(PluginCall call) {
        try {
            super.unregister(call);
        } catch (IllegalStateException exception) {
            call.reject("Push unregistration unavailable: Firebase is not configured.", "FIREBASE_NOT_CONFIGURED", exception);
        }
    }
}
