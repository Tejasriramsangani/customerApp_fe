package com.aslikaata.customer;

import android.Manifest;
import android.content.Intent;
import android.location.LocationManager;
import android.location.Location;
import android.location.LocationListener;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.net.Uri;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.location.LocationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Foreground location and settings only. No background permission or third-party SDK. */
@CapacitorPlugin(name = "LocationAccess", permissions = {
    @Permission(alias = "coarse", strings = { Manifest.permission.ACCESS_COARSE_LOCATION }),
    @Permission(alias = "fine", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
})
public class LocationAccessPlugin extends Plugin {
    private Runnable cancelPosition;
    private PluginCall positionCall;
    private JSObject currentStatus() {
        boolean granted = getPermissionState("coarse") == PermissionState.GRANTED;
        boolean asked = getContext().getSharedPreferences("location-access", 0).getBoolean("asked", false);
        boolean rationale = ActivityCompat.shouldShowRequestPermissionRationale(getActivity(), Manifest.permission.ACCESS_COARSE_LOCATION);
        LocationManager manager = (LocationManager) getContext().getSystemService(android.content.Context.LOCATION_SERVICE);
        JSObject result = new JSObject();
        result.put("state", granted ? "granted" : asked && !rationale ? "blocked" : asked ? "denied" : "prompt");
        result.put("servicesEnabled", manager != null && LocationManagerCompat.isLocationEnabled(manager));
        return result;
    }

    @PluginMethod
    public void status(PluginCall call) { call.resolve(currentStatus()); }

    @PluginMethod
    public void request(PluginCall call) {
        if (getPermissionState("coarse") == PermissionState.GRANTED) { call.resolve(currentStatus()); return; }
        getContext().getSharedPreferences("location-access", 0).edit().putBoolean("asked", true).apply();
        requestPermissionForAliases(new String[] { "coarse", "fine" }, call, "permissionResult");
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) { call.resolve(currentStatus()); }

    @PluginMethod
    @SuppressWarnings("MissingPermission")
    public void position(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (getPermissionState("coarse") != PermissionState.GRANTED) { call.reject("Location access is not allowed", "denied"); return; }
            LocationManager manager = (LocationManager) getContext().getSystemService(android.content.Context.LOCATION_SERVICE);
            if (manager == null || !LocationManagerCompat.isLocationEnabled(manager)) { call.reject("Location services are off", "disabled"); return; }
            if (cancelPosition != null) { call.reject("A location request is already running", "unavailable"); return; }
            positionCall = call;
            Handler handler = new Handler(Looper.getMainLooper());
            final Location[] best = { null };
            final boolean[] finished = { false };
            final Runnable[] deadline = { null };
            LocationListener listener = new LocationListener() {
                private void complete(Location value) {
                    if (finished[0]) return;
                    finished[0] = true; manager.removeUpdates(this); handler.removeCallbacks(deadline[0]); cancelPosition = null; positionCall = null;
                    JSObject result = new JSObject();
                    result.put("latitude", value.getLatitude()); result.put("longitude", value.getLongitude());
                    result.put("accuracy", value.getAccuracy()); result.put("timestamp", value.getTime()); call.resolve(result);
                }
                @Override public void onLocationChanged(Location value) {
                    if (best[0] == null || value.getAccuracy() < best[0].getAccuracy()) best[0] = value;
                    if (value.getAccuracy() <= 100) complete(value);
                }
                @Override public void onProviderEnabled(String provider) {}
                @Override public void onProviderDisabled(String provider) {
                    if (!finished[0] && !LocationManagerCompat.isLocationEnabled(manager)) {
                        if (cancelPosition != null) cancelPosition.run();
                        call.reject("Location services are off", "disabled");
                    }
                }
                @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
            };
            deadline[0] = () -> {
                if (finished[0]) return;
                finished[0] = true; manager.removeUpdates(listener); cancelPosition = null; positionCall = null;
                if (best[0] != null) {
                    JSObject result = new JSObject(); result.put("latitude", best[0].getLatitude()); result.put("longitude", best[0].getLongitude());
                    result.put("accuracy", best[0].getAccuracy()); result.put("timestamp", best[0].getTime()); call.resolve(result);
                } else call.reject("Location detection timed out", "timeout");
            };
            cancelPosition = () -> { finished[0] = true; manager.removeUpdates(listener); handler.removeCallbacks(deadline[0]); cancelPosition = null; positionCall = null; };
            try {
                boolean requested = false;
                if (getPermissionState("fine") == PermissionState.GRANTED && manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0, listener, Looper.getMainLooper()); requested = true;
                }
                if (manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 1000, 0, listener, Looper.getMainLooper()); requested = true;
                }
                if (!requested) { cancelPosition.run(); call.reject("No location provider is available", "unavailable"); return; }
                handler.postDelayed(deadline[0], 12000);
            } catch (SecurityException error) { cancelPosition.run(); call.reject("Location access was revoked", "denied"); }
            catch (Exception error) { cancelPosition.run(); call.reject("Location is unavailable", "unavailable"); }
        });
    }

    private void stopPosition() {
        PluginCall pendingCall = positionCall;
        if (cancelPosition != null) cancelPosition.run();
        if (pendingCall != null) pendingCall.reject("Location request cancelled", "unavailable");
    }
    @Override protected void handleOnDestroy() { stopPosition(); }
    @Override protected void handleOnPause() { stopPosition(); }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = Boolean.TRUE.equals(call.getBoolean("locationServices", false))
                ? new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) { call.reject("Unable to open location settings", error); }
    }
}
