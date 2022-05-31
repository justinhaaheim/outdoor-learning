import * as React from 'react';
import {useCallback, useState, useEffect, useRef} from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardEvent,
  KeyboardAvoidingView,
  Text,
  StyleSheet,
  Image,
  Platform,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import type {RootStackParamList} from '../../types';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ImageCaptureElement} from '../../lesson_content/lessonTypes';
import ChatBubble from '../../components/ChatBubble';
import LessonPrimaryLayout from '../../components/LessonPrimaryLayout';
import ChatScrollViewContainer from '../../components/ChatScrollViewContainer';
import FeaturedCoverImage from '../../components/FeaturedCoverImage';
import TextVoiceInput from '../../components/TextVoiceInput';
import {Camera} from 'expo-camera';
import {navigationDelay} from '../../constants/navigationDelay';
import useTextToSpeech from '../../hooks/useTextToSpeech';

type Props = {
  elementProps: ImageCaptureElement;
  elementId: number;
  totalElements: number;
};

export default function ImageCaptureLessonScreen({
  navigation,
  route,
  elementProps,
  elementId,
  totalElements,
}: NativeStackScreenProps<RootStackParamList, 'LessonContentScreen'> &
  Props): JSX.Element {
  const DEFAULT_TEXT_VOICE_INPUT_BOTTOM = 45;
  const DEFAULT_AVAILABLE_WINDOW_HEIGHT_THRESHOLD = 510;

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    (async () => {
      const {status} = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const [imageCaptured, setImageCaptured] = useState<Boolean>(false);
  const [showNavigation, setShowNavigation] = useState<boolean>(true);
  const [showChatArea, setShowChatArea] = useState<boolean>(true);
  const {messages, afterCaptureMessages} = elementProps;
  const [imageFilePath, setImageFilePath] = useState<string | null>(null);
  const [imageCaptureStarted, setImageCaptureStarted] =
    useState<boolean>(false);
  const navigationDelayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [textVoiceInputBottom, setTextVoiceInputBottom] = useState<number>(
    DEFAULT_TEXT_VOICE_INPUT_BOTTOM,
  );

  const cameraRef = React.useRef<Camera>(null);

  const messagesToDisplay = imageCaptured ? afterCaptureMessages : messages;

  // The array of messages passed to this hook should never change, except by appending new messages to read.
  // So after image capture we still need to provide the original messages array to the hook.
  useTextToSpeech(
    imageCaptured ? messages.concat(afterCaptureMessages) : messages,
    true,
  );

  useEffect(() => {
    return () => {
      if (navigationDelayTimerRef.current) {
        clearTimeout(navigationDelayTimerRef.current);
      }
    };
  }, []);

  const onKeyboardDidShow = useCallback((e: KeyboardEvent) => {
    setShowChatArea(false);
    const availableWindowHeight =
      Dimensions.get('window').height - e.endCoordinates.height;
    if (availableWindowHeight > DEFAULT_AVAILABLE_WINDOW_HEIGHT_THRESHOLD) {
      setTextVoiceInputBottom(0);
    }
  }, []);

  const onKeyboardDidHide = useCallback(() => {
    const availableWindowHeight = Dimensions.get('window').height;
    setTextVoiceInputBottom(DEFAULT_TEXT_VOICE_INPUT_BOTTOM);
  }, []);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      'keyboardDidShow',
      onKeyboardDidShow,
    );
    const hideSubscription = Keyboard.addListener(
      'keyboardDidHide',
      onKeyboardDidHide,
    );
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [onKeyboardDidHide, onKeyboardDidShow]);

  async function handleTakePicture() {
    setImageCaptureStarted(true);
    const camera = cameraRef.current;
    if (camera == null) {
      console.error('Camera is nullish when trying to take a picture');
      return;
    }
    const pictureObj = await camera.takePictureAsync();

    console.log('Picture taken!', pictureObj);
    setImageCaptured(true);
    setShowNavigation(false);

    try {
      console.log('Saving temporary file to permanent location');
      const newFilePath = `${
        FileSystem?.documentDirectory ?? ''
      }/${new Date().toJSON()}-image.jpg`;
      FileSystem.copyAsync({
        from: pictureObj.uri,
        to: newFilePath,
      });
      setImageFilePath(newFilePath);
    } catch (error) {
      console.error('Error when attempting to save image', error);
    }
  }

  function onSaveCallback() {
    navigationDelayTimerRef.current = setTimeout(() => {
      if (elementId < totalElements - 1) {
        navigation.navigate('LessonContentScreen', {elementId: elementId + 1});
      }
    }, navigationDelay);
  }

  let topElement = imageCaptured ? (
    imageFilePath != null && (
      <FeaturedCoverImage imageSource={{uri: imageFilePath}} />
    )
  ) : (
    <View style={styles.cameraContainer}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={'back'}
        onCameraReady={() => setCameraReady(true)}
      />
    </View>
  );

  if (hasPermission === null) {
    topElement = (
      <View>
        <ActivityIndicator />
      </View>
    );
  }
  if (hasPermission === false) {
    topElement = <Text>No access to camera</Text>;
  }

  const notesView = (
    <View
      style={{
        width: '100%',
        position: 'absolute',
        height: 350,
        bottom: 0,
      }}
    >
      <View
        style={{
          width: '100%',
          position: 'absolute',
          bottom: textVoiceInputBottom,
        }}
      >
        <TextVoiceInput
          placeHolderText="Ask a question"
          onSubmit={() => {}}
          onSave={onSaveCallback}
          isSaveEnabled={true}
          targetImage={imageFilePath}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LessonPrimaryLayout
        elementId={elementId}
        totalElements={totalElements}
        topElement={topElement}
        bottomElement={
          imageCaptured ? undefined : imageCaptureStarted ? (
            <ActivityIndicator />
          ) : (
            <TouchableOpacity onPress={handleTakePicture}>
              <Image
                source={require('assets/TakePhoto3x.png')}
                style={styles.captureButtonImage}
              />
            </TouchableOpacity>
          )
        }
        navigation={navigation}
        route={route}
        showNavigation={showNavigation}
      >
        {showChatArea && (
          <ChatScrollViewContainer
            chatElements={messagesToDisplay.map((message, i) => (
              <ChatBubble
                key={i}
                alignment="left"
                view={<Text style={styles.bubbleText}>{message}</Text>}
                bubbleColor={'rgba(38, 38, 39, 1)'}
                backgroundColor={'#121212'}
              />
            ))}
          />
        )}
        {imageCaptured ? notesView : null}
      </LessonPrimaryLayout>
    </KeyboardAvoidingView>
  );
}

// TODO: Use colors from the theme instead of hardcoding
const styles = StyleSheet.create({
  cameraContainer: {
    // flex: 1,
    height: '100%',
    width: '100%',
    // backgroundColor: 'red',
  },
  camera: {flex: 1},
  captureButtonImage: {width: 60, height: 60},
  bubbleText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 1)',
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
});
