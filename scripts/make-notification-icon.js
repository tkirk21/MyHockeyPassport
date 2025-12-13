import { ImageManipulator } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

async function makeIcon() {
  const manipResult = await ImageManipulator.manipulateAsync(
    './assets/images/logo_no_font.png',
    [{ resize: { width: 96, height: 96 } }],
    { compress: 1, format: ImageManipulator.SaveFormat.PNG }
  );

  await FileSystem.moveAsync({
    from: manipResult.uri,
    to: './assets/images/notification-icon.png',
  });

  console.log('notification-icon.png created!');
}

makeIcon();