import React from 'react';
import {Image} from 'react-native';
import addEncryptedAuthTokenToURL from '../../libs/addEncryptedAuthTokenToURL';

const RESIZE_MODES = {
    contain: 'contain',
    cover: 'cover',
    stretch: 'stretch',
    center: 'center',
};

class FastImage extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            imageSource: undefined,
        };
    }

    componentDidMount() {
        this.configureImageSource();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.source === this.props.source) {
            return;
        }
        this.configureImageSource();
    }

    configureImageSource() {
        const source = this.props.source;
        let imageSource = source;
        if (typeof source !== 'number' && source.headers != null) {
            imageSource = {uri: addEncryptedAuthTokenToURL(source.uri)};
        }
        this.setState({imageSource});
        if (this.props.onLoad == null) {
            return;
        }
        const uri = typeof imageSource === 'number'
            ? Image.resolveAssetSource(imageSource).uri
            : imageSource.uri;
        Image.getSize(uri, (width, height) => {
            this.props.onLoad({nativeEvent: {width, height}});
        });
    }

    render() {
        // eslint-disable-next-line
        const { source, onLoad, ...rest } = this.props;

        // eslint-disable-next-line
        return <Image {...rest} source={this.state.imageSource} />;
    }
}

FastImage.propTypes = Image.propTypes;
FastImage.resizeMode = RESIZE_MODES;
export default FastImage;
