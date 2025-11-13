import { loadConfig, build as rslibBuild } from '@rslib/core';
import esbuild from 'esbuild';
import fs from 'fs';
import gulp, { series } from 'gulp';
import zip from 'gulp-zip';
import path from 'path';
import packageJson from './package.json' with { type: 'json' };

const folder = (packageJson.author + '_' + packageJson.name).toLowerCase().replace(' ', '-');

const filesToCopy = [
    'package.json',
    'LICENSE',
    'README.md',
    'default.gamecontroller.amgp'
];

async function buildTask(done) {
    // Build main extension (Node.js)
    const nodeBuild = esbuild.build({
        bundle: true,
        entryPoints: ['./src/extension.ts'],
        outfile: './dist/extension.js',
        platform: 'node',
        external: ['flashpoint-launcher'],
    });

    const config = await loadConfig('./rslib.config.ts');
    
    Promise.all([nodeBuild, rslibBuild({
        ...config.content,
        mode: 'development'
    })])
    .catch(console.error)
    .finally(done);
}

async function watchTask(done) {
    const ctx = await esbuild.context({
        bundle: true,
        entryPoints: ['./src/extension.ts'],
        outfile: './dist/extension.js',
        platform: 'node',
        external: ['flashpoint-launcher', '*.css'],
    });

    const config = await loadConfig('./rslib.config.ts');
    const renderer = rslibBuild({
        ...config.content,
        mode: 'development',
        watch: true
    });

    return Promise.all([ctx.watch(), renderer])
    .catch(console.error)
    .finally(done);
}

function clean(cb) {
    fs.rm('./package', { recursive: true }, (err) => {
        if (err) { console.log('Clean', err); }
        cb();
    });
}

async function stage() {
    // Ensure base directory exists
    await fs.promises.mkdir(`package/${folder}`, { recursive: true });

    const copyTasks = [];

    // Copy individual files
    for (const file of filesToCopy) {
        if (fs.existsSync(file)) {
            copyTasks.push(
                fs.promises.cp(file, path.join(`package/${folder}`, file))
            );
        }
    }

    // Copy dist directory
    copyTasks.push(packagePathTask('AntiMicroX', (src) => !src.includes('antimicrox_settings.ini')));
    copyTasks.push(packagePathTask('dist'));
    copyTasks.push(packagePathTask('static'));

    await Promise.all(copyTasks);
}

function packagePathTask(src, filter) {
    const dest = `package/${folder}/${src}`;
    return fs.promises.cp(src, dest, { recursive: true, filter });
}

function packageExtTask() {
    return gulp.src('package/**/*').pipe(zip(packageJson.artifactName)).pipe(gulp.dest('.'));
}

export const build = series(buildTask);
export const watch = series(watchTask);
export const packageExt = series(clean, build, stage, packageExtTask);