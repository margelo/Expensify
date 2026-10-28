// The keyboard controller's gesture area needs no version gate on iOS or web.
function canUseKeyboardGestureArea(): boolean {
    return true;
}

export default canUseKeyboardGestureArea;
