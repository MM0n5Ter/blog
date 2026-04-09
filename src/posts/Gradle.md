---
title: Gradle文件中依赖项部分详解
date: 2023-04-04 17:58:40
tags: [Gradle,Android,Build,Dev]
categories: TPLs
description: 在使用Gradle来进行构建安卓apk时，总是绕不开三方库的引入和依赖项的引入，进行一个具体的学
top_img: img/banner/Apr.jpg
cover: img/banner/Apr.jpg

---

这段时间正好进行三方库的研究要获取大量的lib，顺带把Gradle依赖这块搞一搞，主要整理了下Gradle依赖的类型、依赖配置、依赖冲突如何解决。

# 依赖类型

dependencies DSL标签是标准Gradle API中的一部分，而不是Android Gradle插件的特性，所以它不属于android标签。

依赖有三种方式：

```Gradle
dependencies {
    // Dependency on a local library module
    implementation project(":mylibrary")

    // Dependency on local binaries
    implementation fileTree(dir: 'libs', include: ['*.jar'])

    // Dependency on a remote binary
    implementation 'com.example.android:app-magic:12.3'
}
```

## 本地library模块依赖

```Gradle
implementation project(":mylibrary")
```

这种依赖方式是直接依赖本地库工程代码的（需要注意的是，`mylibrary`的名字必须匹配在`settings.gradle`中`include`标签下定义的模块名字）。

## 本地二进制依赖

```Gradle
implementation fileTree(dir: 'libs', include: ['*.jar'])
```

这种依赖方式是依赖工程中的 `module_name/libs/目录下的Jar文件`（注意Gradle的路径是相对于build.gradle文件来读取的，所以上面是这样的相对路径）。

如果只想依赖单个特定本地二进制库，可以如下配置：

```Gradle
implementation files('libs/foo.jar', 'libs/bar.jar')
```

## 远程二进制依赖

最常见，个人基本就只使用过这一种。有两种写法，一种简写一种完整：

```Gradle
implementation 'com.example.android:myclass:12.3'

implementation group: 'com.example.android', name: 'myclass', version: '12.3'
```

# 依赖配置

目前Gradle版本支持的依赖配置有：`implementation`、`api`、`compileOnly`、`runtimeOnly` 和 `annotationProcessor`，已经废弃的配置有：`compile`、`provided`、`apk`、`providedCompile`。此外依赖配置还可以加一些配置项，例如`AndroidTestImplementation`、`debugApi`等等。

但是我们常常还能找到各种各样的前缀，比如会有：`testCompile`，` testImplementation`，`androidTestImplementation`等等等等，以下先讲主要配置：

## implementation

会添加依赖到编译路径，并且会将依赖打包到输出，但是在编译时不会将依赖的实现暴露给其他module，也就是只有在运行时其他module才能访问这个依赖中的实现。使用这个配置，可以显著提升构建时间，因为它可以减少重新编译的module的数量。

这个指令的特点就是，对于使用了该命令编译的依赖，对该项目有依赖的项目将无法访问到使用该命令编译的依赖中的任何程序，也就是将该依赖隐藏在内部，而不对外部公开。

## api

> 提一嘴，虽然`compile`已经废弃了，但是由于我分析的可能还有很多老版本，所以还是会有很多`compile`在里面的。事实上，`compile`完全等同于`api`

会添加依赖到编译路径，并且会将依赖打包到输出，与`implementation`不同，这个依赖可以传递，其他module无论在编译时和运行时都可以访问这个依赖的实现，也就是会泄漏一些不应该不使用的实现。举个例子，A依赖B，B依赖C，如果都是使用`api`配置的话，A可以直接使用C中的类（编译时和运行时），而如果是使用`implementation`配置的话，在编译时，A是无法访问C中的类的。

## compileOnly

> 等于老版本的`provided`

把依赖加到编译路径，编译时使用，不会打包到输出。这可以减少输出的体积，在只在编译时需要，在运行时可选的情况，很有用。

## runtimeOnly

> 等于老版本的`apk`

依赖会一起打包到apk，运行时调用，但是不会添加到编译路径，应该不会一起混淆和优化。

# 依赖冲突

## 定位冲突

依赖冲突可能会报类似下面的错误：

```
Program type already present com.example.MyClass
```

通过查找类的方式（ctrl + O）定位到冲突的依赖，进行排除。

## 排除依赖

### dependencies中排除（细粒度）

```Gradle
compile('com.taobao.android:accs-huawei:1.1.2@aar') {
        transitive = true
        exclude group: 'com.taobao.android', module: 'accs_sdk_taobao'
}
```

### 全局配置排除

```Gradle
configurations {
    compile.exclude module: 'cglib'
    //全局排除原有的tnet jar包与so包分离的配置，统一使用aar包中的内容
    all*.exclude group: 'com.taobao.android', module: 'tnet-jni'
    all*.exclude group: 'com.taobao.android', module: 'tnet-so'
}
```

### 禁用依赖传递

```Gradle
compile('com.zhyea:ar4j:1.0') {
    transitive = false
}

configurations.all {
    transitive = false
}
```

还可以在引入是标注`@jar`

```Gradle
compile 'com.zhyea:ar4j:1.0@jar'
```

### 强制使用某个版本

如果某个依赖项是必需的，而又存在依赖冲突时，此时没必要逐个进行排除，可以使用`force`属性标识需要进行依赖统一。

```Gradle
compile('com.zhyea:ar4j:1.0') {
    force = true
}

configurations.all {
    resolutionStrategy {
        force 'org.hamcrest:hamcrest-core:1.3'
    }
}
```

### 后记

其实本人并不是干开发的，所以记录的这些只是对一些分析很有帮助，感觉对于开发是远远不够的

