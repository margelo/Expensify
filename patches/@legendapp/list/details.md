# `@legendapp/list` patches

### [@legendapp+list+3.3.5+001+scroll-view-component.patch](@legendapp+list+3.3.5+001+scroll-view-component.patch)

- Reason:

    `KeyboardAwareLegendList` uses `KeyboardChatScrollView`, which supports replacing its underlying Reanimated scroll view through `ScrollViewComponent`. However, `KeyboardAwareLegendList` omits that prop from its public type and does not forward it explicitly. Exposing and forwarding the prop allows consumers to customize the underlying scroll view without replacing the keyboard-aware scroll renderer.

- Upstream PR/issue: -
- E/App issue: -
- PR introducing patch: -
