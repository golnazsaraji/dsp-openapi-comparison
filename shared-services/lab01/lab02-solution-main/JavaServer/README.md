# Image Converter - Java gRPC Server
This repository contains the [grpc Server](/JavaServer) to be used in the Laboratory 2 activity in order to convert the image files.

## Build and Run
You can use Eclipse to make the project run. You need to:
- Import the project: File -> Import -> Select "Existing Maven Project..." -> Select the root directory clicking "Browse..." -> Click on "Finish"
- Run Maven by: Project -> Update Maven Project -> Click "Ok"
- Go on the ConversionServer.java file and click on "Run"

### OS Notice

This Java Server requires a Linux machine to run. If you need to run it on a different OS, change the `<os.detected.classifier>` value in the `<property>` tag in the  `pom.xml` from `linux-x86_64` to the correct one according to your OS — for example:

- `windows-x86_64` for Windows

- `osx-x86_64` for Intel-based macOS

- `osx-aarch_64` for ARM based macOS systems.

However this code has not been tested on other OS, so we encourage the usage of Linux for this laboratory.
