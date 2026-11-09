// The keyboard controller's Android gesture view requires the system's interactive keyboard API.
import {Platform} from 'react-native';

const MIN_ANDROID_VERSION_FOR_KEYBOARD_GESTURES = 30;

function canUseKeyboardGestureArea(): boolean {
    return Number(Platform.Version) >= MIN_ANDROID_VERSION_FOR_KEYBOARD_GESTURES;
}

export default canUseKeyboardGestureArea;
