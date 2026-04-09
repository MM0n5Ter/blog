---
title: Soot从入门到入土(2)-IR(Jimple)
date: 2023-04-6 17:07:03
tags: [Soot,Android,Tools,RE,Java]
categories: Tools
description: 接下来对TPLs的研究将用到soot工具，先进行一个学习
top_img: img/banner/Apr.jpg
cover: img/banner/Apr.jpg
---

> 依稀记得在NJU谭添老师的课上讲过一些

## 编译器

在了解**IR**（中间代码）之前，首先要了解一个编译器是如何运作的，也就是编译原理，在这里并不会过多赘述。

- 词法分析：正则表达式找出单词并判断拼写，打上token进入下一环节
- 语法分析：同过上下文无关算法来判断是否符合语法，转化为AST进入下一环节
- 语义分析：通过属性语法来判断是否有问题，包括作用域，类型检查等等，生成修饰过的AST
- 优化：生成IR，并进行各种优化
- 目标代码生成：通过IR生成目标代码

> 静态分析通常是在IR上进行的，所以也称IR为静态分析的基石

## 3AC(3-Address Code)

三地址码是一种常见的中间代码形式，而Soot就是一种三地址码。

格式：在一个语句右侧只有一个操作符。

常见的形式如下所示：

```java
x = y bop z 		//bop 指二元运算符
x = uop z           //uop 指一元运算符
x = y
goto L
if x goto L
if x rop y goto L   //rop 指二元关系判断运算符
```

在产生三地址码的过程中，不可避免的要产生中间变量以满足其要求：

```java
a = b + c - d * e
-----------------
t1 = d * e
t2 = c - t1
a = b + t2
```

## Jimple语法与API

- **invokespecial**：用来调用构造函数，父类方法和私有方法（constructor、superclass method、private method）。
- **invokevirtual**：用来调用实例方法、基于类进行分派（instance method、virtual dispatch）
- **invokeinterface**：用来调用接口中的方法
- **invokestatic**：用来调用静态方法

> 实际上在学习了编译原理之后，对于整个程序大致流程会产生什么样的中间代码已经基本清楚了，但对于不同的编程语言产生的一些接口还需要进一步的实践了解

## Jimple示例

Jimple是一种典型的三地址码。下面给出一些简单的Java代码和对应的Jimple代码作为示例：

### do-while 循环

```java
public class DoWhileLoop3AC{
	public static void main(String[] args){
		int[] arr = new int[10];
		int i = 0;
		do {
			i = i + 1;
		}while(arr[i] < 10)
	}
}
```

```jimple
public static void main(java.lang.String[])
{
	java.lang.String[] r0;
	int[] r1;
	int $i0,i1;

	r0 := @parameter0: java.lang.String[];
	r1 = newarray (int)[10];
	i1 = 0;
	
label1:
	i1 = i1 + 1;
	$i0 = r1[i1];
	if $i0 < 10 goto label1;

	return;
}
```

### 方法调用

```java
public class MethodCall3AC{

	String foo(String para1,String para2){
		return para1 + " " + para2;
	}
	
	public static void main(String[] args){
		MehtodCall3AC mc = new MehtodCall3AC();
		String result = mc.foo("hello","world"); 
	}
	
}
```

```jimple
java.lang.String foo(java.lang.String,java.lang.String)
{
	MethodCall3AC r0;
	java.lang.String r1, r2, $r7;
	java.lang.StringBuilder $r3,$r4,$r5,$r6;

	r0 := @this: MethodCall3AC;
	r1 := @parameterr0: java.lang.String;
	r2 := @parameterr1: java.lang.String;
	$r3 = new java.lang.StringBulider;
	
	specialinvoke $r3.<java.lang.StringBulider: void<init>()>();
	$r4 = virtualinvoke $r3.<java.lang.StringBulider: java.lang.StringBulider append(java.lang.String)>(r1);
	$r5 = virtualinvoke $r4.<java.lang.StringBulider: java.lang.StringBulider append(java.lang.String)>(" ");
	$r6 = virtualinvoke $r5.<java.lang.StringBulider: java.lang.StringBulider append(java.lang.String)>(r2);
	$r7 = virtualinvoke $r6.<java.lang.StringBulider: java.lang.String toString()>();

	return $r7;
}

public static void main(java.lang.String[])
{
	java.lang.String[] r0;
	MethodCall3AC $r1;

	r0:= @parameter0: java.lang.String[];
	$r1= new MethodCall3AC;
	
	specialinvoke $r1.<MethodCall3AC: void<init>()>();
	virtualinvoke $r1.<MethodCall3AC: java.lang.String foo(java.lang.Stirng,java.lang.String)>("hello","world");
	
	return;
}
```

### 类

```java
package a.b.c;
public class Class3AC{

	public static final double pi = 3.14;
	public static void main(String[] args){
	}
	
}
```

```jimple
public class a.b.c.Class3AC extends java.lang.Object
{
	public static final double pi;

	public void <init>()
	{
		a.b.c.Class3AC r0;
		r0 := @this: a.b.c.Class3AC;
		specialinvoke r0.<java.lang.Object: void <init>()>();
		return;
	}
	
	public static void main(java.lang.String[])
	{
		java.lang.String[] r0;
		r0:= @parameter0: java.lang.String[];
		return;
	}
	public static void <clinit>()
	{
		<a.b.c.Class3AC: double pi> = 3.14;
		return;
	}
}
```

