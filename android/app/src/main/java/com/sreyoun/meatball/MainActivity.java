package com.sreyoun.meatball;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SreyounPrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
