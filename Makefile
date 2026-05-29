.PHONY: all install build dev clean lint preview

# 默认运行目标
all: build

# 安装依赖 (node_modules)
install:
	@echo "Installing Portal dependencies..."
	@[ -d node_modules ] || npm install

# 编译构建静态资产 (dist/)
build: install
	@echo "Building code-bench Portal..."
	npm run build

# 启动本地开发调试服务器
dev: install
	@echo "Starting dev server..."
	npm run dev

# 执行代码风格与语法检查
lint: install
	@echo "Running linter..."
	npm run lint

# 启动本地生产预览
preview: build
	@echo "Starting production preview..."
	npm run preview

# 清理构建产物
clean:
	@echo "Cleaning dist directory..."
	rm -rf dist
