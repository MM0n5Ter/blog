---
title: ECC Note 1
date: 2021-05-30 15:48:50
tags: [ecc,Crypto,旧地狱]
categories: 旧地狱
mathjax: true
---

原因不明地咕了很久很久。。。

虽然感觉不太好，但是这次六级已经不准备去考了。

# **1.椭圆曲线的概念**

椭圆曲线具有以下格式（区别于高中知识）：
$$
y^2\equiv x^3+ax+a\ modp
$$
$\ast$此处所示$x,y\in\mathbb{Z}_p$

$\ast\ast\ 4a^2+27b^2\neq0\ modp$  ，这一约束条件是为了保证该曲线不会自交且有顶点

# **2.椭圆曲线上的加法**

我们已知$(x_1,y_1),(x_2,y_2)$是在该曲线上的，我们定义曲线上两点的加法是该两点连线的延长线与曲线的另一交点，若为两相同点，则为在该点的切线与曲线的另一交点。
$$x_3\equiv s^2-x_1-x_2\ (modp) $$

$$y_3\equiv s(x_1-x_3)-y_1\ (modp)$$

其中：

$$s=\frac{y_2-y_1}{x_2-x_1}; 相异点相加$$

$$s=\frac{3x_1^2+a}{2y_1}; 相同点相加$$

这里的s其实就是那条直线的斜率

同时我们定义点$P(x_1,y_1)$的逆元为$-P(x_1,-y1)$，它们的关系为：$P+(-P)=\vartheta$，同时$\vartheta$拥有性质：$\forall P,P+\vartheta = P $

我们将$\vartheta$命名为单位元，它位于椭圆曲线图上的无限远处

# **3.使用椭圆曲线构造离散对数问题**

曲线上的所有点刚好构成一个阿贝尔群，且对于一个椭圆曲线，存在$k$，使得$kP+P=P$，即$kP=\vartheta$这个$k$被称为阶

我们有Hasse's定理来确定阶的范围（p为模数）：
$$
p+1-2\sqrt{p}<E<p+1+2\sqrt{p}
$$
而已知$P$要求$kP$，我们可以使用类似快速幂的算法

# **4.基于椭圆曲线的Diffie-Hellman密钥交换**

大前提：使用同一个椭圆方程，同一个素数p和同一个本原元$P(x_0,y_0)$

alice任取a，bob任取b，分别作aP和bP，同时交换所得结果

alice再对所得结果乘a，bob同理，得到联合密钥$T_{ab}$
$$
T_{ab}=(x_{ab},y_{ab})=abP
$$


P.S:我好短，嘤嘤嘤

# **5.简单代码（记录一下sage上的写法）**

```python
k.<a> = GF(p)
E = EllipticCurve(k, a, b)
P = E([x1, y1])
Q = E([x2, y2])
for i in range(p):
    if (i * P == Q):
        print(i)
        break
```
