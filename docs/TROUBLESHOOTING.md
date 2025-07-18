# Troubleshooting

## Quick Fixes

Try these first:

1. Refresh the Roll20 page
2. Reconnect your dice
3. Reload the extension

## Common Issues

### Extension Not Working

- **No icon?** → Check chrome://extensions/, make sure it's enabled
- **Buttons don't work?** → Refresh Roll20 page, check you're on a game page
- **Popup errors?** → Press F12, look for red errors in console

### Bluetooth Problems

**Single Device Issues:**
- **No devices found?** → Roll dice to wake them, check Bluetooth is on
- **Won't connect?** → Make sure dice aren't connected to other devices
- **Keeps disconnecting?** → Keep dice close to computer, check battery

**Multiple Device Issues:**
- **Can't connect second die?** → Make sure first die is fully connected before adding second
- **Dice interfering with each other?** → Each die uses unique device ID, interference unlikely
- **Some dice not responding?** → Check individual connection status in popup
- **Mixed connection states?** → Try reconnecting all dice one by one

### Roll20 Issues

- **Rolls not showing?** → Check connection status in popup
- **Wrong chat format?** → Verify game settings and permissions
- **Modifier box missing?** → Click "Show Modifier Box" in popup
- **Can't close modifier box?** → Use "Hide Modifier Box" button in popup
- **Box disappeared?** → It may be minimized (click "−" again) or hidden via popup
- **Wrong display format?** → Box visibility affects chat format (detailed vs simple)

### Dice Issues

**Single Die:**
- **Not responding?** → Charge dice, try rolling gently to wake
- **Wrong values?** → Check modifier settings, reconnect if needed
- **LED not working?** → Dice might be in sleep mode, roll to activate

**Multiple Dice:**
- **Only one die working?** → Check connection status for each die in popup
- **Dice sending duplicate rolls?** → Each die should have unique device ID
- **Inconsistent behavior?** → Try disconnecting all dice and reconnecting one by one

## Still Having Issues?

### For Developers

1. Open browser console (F12)
2. Look for JavaScript errors
3. Check the extension's background page in chrome://extensions/
4. Test with `test.html` file

### Reset Everything

1. Disconnect dice from all devices
2. Reload the extension in chrome://extensions/
3. Refresh Roll20 page
4. Reconnect dice

### Getting Help

- Check existing GitHub issues
- Include browser console errors in bug reports
- Mention your Chrome version and OS

Most problems are solved by refreshing the page and reconnecting dice.
