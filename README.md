# Reaction Viewer

<p align="center">
  在 VS Code 中并排比较、对齐和播放分子轨迹。<br>
  Compare, align, and play molecular trajectories side by side in VS Code.
</p>

<p align="center">
  <a href="#中文">中文</a> · <a href="#english">English</a>
</p>

---

## 中文

Reaction Viewer 是一个 VS Code 扩展，用于通过 3Dmol.js 并排查看和比较 1–3 个 XYZ 或文本格式的 TRJ 分子轨迹。查看器所需资源均包含在扩展中，运行时无需联网。

### 功能

- 从资源管理器选择 1–3 个 `.xyz` / `.trj` 文件，右键打开；也可以从命令面板运行 **Reaction Viewer: Open Molecular Comparison**。
- 使用球棍模型并排显示多个 3Dmol.js 视图。
- 联动旋转、平移和缩放：操作任意面板，其他面板会同步视角。
- **Center XYZ**：逐帧移除每个结构的几何中心偏移。
- **Kabsch align**：根据第一帧的原子顺序，将所有选中轨迹刚性对齐到第一个文件，并将变换应用到全部帧。
- 多帧轨迹共享播放、帧滑块和播放速度控制。
- 自动识别金属–供体配位接触，并用分离清晰的彩色虚线显示；工具栏提供 Strict、Normal 和 Wide 三档距离阈值。
- 当文件名为 `reactant.xyz`、`transition_state.xyz` 和 `product.xyz` 时，自动启用反应模式，显示能量曲线、正逆反应能垒、反应能和反应中心。

配位键基于元素类型与共价半径缩放距离进行启发式判断。默认 **Normal** 适用于常见过渡金属配合物；使用 **Strict** 可减少误判，使用 **Wide** 可显示较长的离子接触。氢接触和金属–金属接触不会被归类为配位键。

### 安装与使用

1. 在 VS Code 中打开扩展视图。
2. 从右上角 `…` 菜单选择 **Install from VSIX...**，然后选择生成的 `.vsix` 文件。
3. 在资源管理器中选择最多三个 `.xyz` 或 `.trj` 文件并右键。
4. 选择 **Reaction Viewer: Open Molecular Comparison**。

也可以先打开文件所在工作区，再从命令面板执行同名命令并选择轨迹文件。

### 反应能与反应中心

在三个反应文件的 XYZ 注释行中分别提供能量，例如：

```text
energy=-100.123456 hartree
```

支持 `hartree` / `Ha` / `a.u.`、`eV`、`kcal/mol` 和 `kJ/mol`。可换算的能量统一显示为相对 `kcal/mol`。如果不提供单位，则三个值都必须无单位，能量曲线会使用通用能量单位。

反应中心通过比较反应物与产物的共价连接关系推断。周围结构会淡化，中心原子保留元素颜色；断裂键显示为红色，新生成键显示为绿色。三个文件必须包含相同的原子，并保持相同顺序。

### 支持的轨迹格式

`.xyz` 和 `.trj` 当前均按多帧 XYZ 文本解析：

```text
3
frame 1
O  0.000  0.000  0.000
H  0.958  0.000  0.000
H -0.240  0.927  0.000
3
frame 2
...
```

每一帧必须具有相同的原子数量和元素顺序。二进制 TRJ 需要对应格式的拓扑和解析器，目前不支持。

### 开发与打包

```bash
npm install
npm test
npm run compile
npx @vscode/vsce package
```

在 VS Code 中打开项目目录并按 `F5`，即可启动 Extension Development Host 进行调试。

---

## English

Reaction Viewer is a VS Code extension for viewing and comparing one to three XYZ or text-based TRJ molecular trajectories side by side with 3Dmol.js. All viewer assets are bundled with the extension, so no network connection is required at runtime.

### Features

- Select 1–3 `.xyz` / `.trj` files in the Explorer and open them from the context menu, or run **Reaction Viewer: Open Molecular Comparison** from the Command Palette.
- Compare structures in side-by-side 3Dmol.js stick-and-sphere viewers.
- Linked rotation, pan, and zoom: manipulate any panel and the others follow.
- **Center XYZ** removes each frame's centroid independently.
- **Kabsch align** rigidly aligns every selected trajectory to the first file using the atom order in the first frame, then applies the transform to all frames.
- Shared playback, frame scrubbing, and speed controls for multi-frame trajectories.
- Automatic metal–donor contact detection with clearly separated, element-colored dashed coordination bonds; Strict, Normal, and Wide distance cutoffs are available in the toolbar.
- Automatic reaction mode for files named `reactant.xyz`, `transition_state.xyz`, and `product.xyz`, including an energy profile, forward and reverse barriers, reaction energy, and reaction-center highlighting.

Coordination bonds are identified heuristically from element types and covalent-radius-scaled distances. The default **Normal** cutoff works well for common transition-metal complexes; use **Strict** to reduce false positives or **Wide** for longer ionic contacts. Hydrogen and metal–metal contacts are not classified as coordination bonds.

### Install and use

1. Open the Extensions view in VS Code.
2. Choose **Install from VSIX...** from the `…` menu, then select the generated `.vsix` file.
3. Select up to three `.xyz` or `.trj` files in the Explorer and right-click.
4. Choose **Reaction Viewer: Open Molecular Comparison**.

Alternatively, open the containing workspace, run the same command from the Command Palette, and select the trajectory files.

### Reaction energies and centers

Put an energy on the XYZ comment line of all three reaction files, for example:

```text
energy=-100.123456 hartree
```

Accepted units are `hartree` / `Ha` / `a.u.`, `eV`, `kcal/mol`, and `kJ/mol`. Convertible values are reported as relative `kcal/mol`. If no unit is supplied, all three values must be unitless and the profile is shown in generic energy units.

The reaction center is inferred by comparing covalent connectivity in the reactant and product using atom order. The surrounding structure is faded while center atoms retain their element colors; broken bonds are red and formed bonds are green. All three files must contain the same atoms in the same order.

### Supported trajectory input

Both `.xyz` and `.trj` are currently parsed as multi-frame XYZ text:

```text
3
frame 1
O  0.000  0.000  0.000
H  0.958  0.000  0.000
H -0.240  0.927  0.000
3
frame 2
...
```

Every frame must contain the same number of atoms in the same element order. Binary TRJ variants require a format-specific topology and parser and are not currently supported.

### Develop and package

```bash
npm install
npm test
npm run compile
npx @vscode/vsce package
```

Open this folder in VS Code and press `F5` to start an Extension Development Host.
