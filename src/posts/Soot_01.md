---
title: Soot从入门到入土(1)-环境配置和基础命令
date: 2023-03-28 19:10:48
tags: [Soot,Android,Tools,RE,Java]
categories: Tools
description: 接下来对TPLs的研究将用到soot工具，先进行一个学习
top_img: img/banner/Mar.jpg
cover: img/banner/Mar.jpg
---

## 环境搭建和配置

由于本人的Java水平并不是很行，没办法直接上源码自己编译，所以搞了一个打包好了的老版本 4.1.0

把jar包下载下来就算配置完成（由于后面要应用soot进行realworld实战，还是得去搞一下最新版）

## 命令行基础操作

```bash
$ java -cp sootclasses-trunk-jar-with-dependencies.jar soot.Main --help

General Options:
 -coffi                        Use the good old Coffi front end for parsing
                               Java bytecode (instead of using ASM).
 -jasmin-backend               Use the Jasmin back end for generating Java
                               bytecode (instead of using ASM).
 -h, -help                     Display help and exit
 -pl, -phase-list              Print list of available phases
 -ph ARG -phase-help ARG       Print help for specified ARG
 -version                      Display version information and exit
 -v, -verbose                  Verbose mode
 -interactive-mode             Run in interactive mode
 ...
```

详细的option自己看命令行或者[Soot Command Line Options (soot-oss.github.io)](https://soot-oss.github.io/soot/docs/4.4.0/options/soot_options.html)

编写一个小代码来测试，根据教程，需要先将 .java 编译为 .class 再进行分析

```bash
$ javac *.java
$ ls *.class
test1.class
$ java -cp sootclasses-trunk-jar-with-dependencies.jar soot.Main test1
```

出现大报错：

```
java.nio.file.NotDirectoryException: /modules/modules                                                                           at java.base/jdk.internal.jrtfs.JrtDirectoryStream.<init>(JrtDirectoryStream.java:59)
        at java.base/jdk.internal.jrtfs.JrtPath.newDirectoryStream(JrtPath.java:642)
        at java.base/jdk.internal.jrtfs.JrtFileSystemProvider.newDirectoryStream(JrtFileSystemProvider.java:309)
        at java.base/java.nio.file.Files.newDirectoryStream(Files.java:476)
        at soot.asm.AsmJava9ClassProvider.find(AsmJava9ClassProvider.java:50)
        at soot.SourceLocator.getClassSource(SourceLocator.java:187)
        at soot.Scene.tryLoadClass(Scene.java:967)
        at soot.Scene.loadBasicClasses(Scene.java:1708)
        at soot.Scene.loadNecessaryClasses(Scene.java:1807)
        at soot.Main.run(Main.java:241)
        at soot.Main.main(Main.java:141)
......
```

查询了issue，并没有发现一样的报错，但是有一个issue说：

> There is no `rt.jar` in Java versions newer than 8. Soot has a feature to load classes from the new module file system. Have a look at the `ModuleScene`.

更新soot到了4.4.0的版本，出现了新的报错：

```bash
$ java -cp soot.jar soot.Main test1
SLF4J: No SLF4J providers were found.
SLF4J: Defaulting to no-operation (NOP) logger implementation
SLF4J: See https://www.slf4j.org/codes.html#noProviders for further details.
Soot started on Wed Mar 29 11:52:55 CST 2023
soot.SootResolver$SootClassNotFoundException: couldn't find class: test1 (is your soot-class-path set properly?)
```

查找问题是没有设置`CLASSPATH`，加上`-cp`的参数后，出现新的报错：

```bash
$ java -cp soot.jar soot.Main -cp . test1
SLF4J: No SLF4J providers were found.
SLF4J: Defaulting to no-operation (NOP) logger implementation
SLF4J: See https://www.slf4j.org/codes.html#noProviders for further details.
Soot started on Wed Mar 29 11:54:45 CST 2023
java.lang.RuntimeException: None of the basic classes could be loaded! Check your Soot class path!
```

查找问题是`CLASSPATH`不足，可以加上`-pp`参数，自动把环境变量中的`{JAVA_HOME}/lib/rt.jar`添加到`CLASSPATH`中，运行成功。

> 在运行是，发现soot中使用了SLF4J，会出现报错，但我是直接在命令行使用而非maven中使用，所以不是很好处理。

## 生成Jimple三地址码

使用`-f`参数来指定输出文件的格式

```bash
$ java -cp soot.jar soot.Main -cp . -pp test1 -f J
```

原始函数如下所示：

```java
    public int encrypt(int m) {
        int c = (int)Math.pow(m, e)%N;
        return c;
    }
```

生成的三地址码如下所示：

```java
    public int encrypt(int)
    {
        test1 r0;
        int i0, $i1, $i2, $i3, i4;
        double $d0, $d1, $d2;

        r0 := @this: test1;

        i0 := @parameter0: int;

        $d1 = (double) i0;

        $i1 = r0.<test1: int e>;

        $d0 = (double) $i1;

        $d2 = staticinvoke <java.lang.Math: double pow(double,double)>($d1, $d0);

        $i3 = (int) $d2;

        $i2 = r0.<test1: int N>;

        i4 = $i3 % $i2;

        return i4;
    }
```

