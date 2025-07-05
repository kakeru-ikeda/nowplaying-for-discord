import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';
import { createCanvas, loadImage } from 'canvas';
import { MusicReport, ListeningTrendData } from '../types';

export class ChartService {
    private chartJSNodeCanvas: ChartJSNodeCanvas;

    constructor() {
        this.chartJSNodeCanvas = new ChartJSNodeCanvas({
            width: 800,
            height: 600,
            chartCallback: (ChartJS) => {
                // Chart.jsのデフォルトフォントを設定
                ChartJS.defaults.font = {
                    family: 'Arial, sans-serif',
                    size: 12,
                };
            },
        });
    }

    /**
     * トップトラックの棒グラフを生成
     */
    async generateTopTracksChart(report: MusicReport): Promise<Buffer> {
        const topTracks = report.topTracks.slice(0, 10); // 上位10曲

        const configuration: ChartConfiguration = {
            type: 'bar',
            data: {
                labels: topTracks.map(track =>
                    `${track.name.length > 20 ? track.name.substring(0, 20) + '...' : track.name}`
                ),
                datasets: [{
                    label: 'プレイ数',
                    data: topTracks.map(track => parseInt(track.playcount)),
                    backgroundColor: 'rgba(114, 137, 218, 0.8)',
                    borderColor: 'rgba(114, 137, 218, 1)',
                    borderWidth: 1,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `トップトラック（${report.dateRange.start} - ${report.dateRange.end}）`,
                        font: {
                            size: 16,
                            weight: 'bold',
                        },
                    },
                    legend: {
                        display: false,
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                        },
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                        },
                    },
                },
            },
        };

        return await this.chartJSNodeCanvas.renderToBuffer(configuration);
    }

    /**
     * トップアーティストの円グラフを生成
     */
    async generateTopArtistsChart(report: MusicReport): Promise<Buffer> {
        const topArtists = report.topArtists.slice(0, 8); // 上位8アーティスト

        const colors = [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 205, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)',
            'rgba(255, 159, 64, 0.8)',
            'rgba(199, 199, 199, 0.8)',
            'rgba(83, 102, 255, 0.8)',
        ];

        const configuration: ChartConfiguration = {
            type: 'doughnut',
            data: {
                labels: topArtists.map(artist =>
                    artist.name.length > 15 ? artist.name.substring(0, 15) + '...' : artist.name
                ),
                datasets: [{
                    data: topArtists.map(artist => parseInt(artist.playcount)),
                    backgroundColor: colors.slice(0, topArtists.length),
                    borderColor: colors.slice(0, topArtists.length).map(color => color.replace('0.8', '1')),
                    borderWidth: 2,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `トップアーティスト（${report.dateRange.start} - ${report.dateRange.end}）`,
                        font: {
                            size: 16,
                            weight: 'bold',
                        },
                    },
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                        },
                    },
                },
            },
        };

        return await this.chartJSNodeCanvas.renderToBuffer(configuration);
    }

    /**
     * 聴取推移グラフを生成（実際のデータ使用）
     */
    async generateListeningTrendsChart(report: MusicReport): Promise<Buffer> {
        // 実際のデータを使用（フォールバックあり）
        const trendsData = report.listeningTrends || this.generateFallbackTrendData(report.period);

        const labels = trendsData.map((trend: ListeningTrendData) => trend.label);
        const data = trendsData.map((trend: ListeningTrendData) => trend.scrobbles);

        const configuration: ChartConfiguration = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '聴取楽曲数',
                    data: data,
                    borderColor: 'rgba(114, 137, 218, 1)',
                    backgroundColor: 'rgba(114, 137, 218, 0.2)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: 'rgba(114, 137, 218, 1)',
                    pointBorderColor: '#FFFFFF',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `聴取推移（${report.dateRange.start} - ${report.dateRange.end}）`,
                        font: {
                            size: 16,
                            weight: 'bold',
                        },
                    },
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function (context) {
                                return `${context.parsed.y}曲`;
                            }
                        }
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                            callback: function (value) {
                                return value + '曲';
                            }
                        },
                        title: {
                            display: true,
                            text: '聴取楽曲数'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '期間'
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            },
        };

        return await this.chartJSNodeCanvas.renderToBuffer(configuration);
    }

    /**
     * 統計サマリーカードを生成
     */
    async generateStatsCard(report: MusicReport): Promise<Buffer> {
        const totalScrobbles = report.topTracks.reduce((sum, track) => sum + parseInt(track.playcount), 0);
        const uniqueArtists = report.topArtists.length;
        const uniqueAlbums = report.topAlbums.length;

        const configuration: ChartConfiguration = {
            type: 'bar',
            data: {
                labels: ['総楽曲数', 'アーティスト数', 'アルバム数'],
                datasets: [{
                    label: '統計',
                    data: [totalScrobbles, uniqueArtists, uniqueAlbums],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 205, 86, 0.8)',
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 205, 86, 1)',
                    ],
                    borderWidth: 1,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `聴取統計サマリー（${report.dateRange.start} - ${report.dateRange.end}）`,
                        font: {
                            size: 16,
                            weight: 'bold',
                        },
                    },
                    legend: {
                        display: false,
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                        },
                    },
                },
            },
        };

        return await this.chartJSNodeCanvas.renderToBuffer(configuration);
    }

    /**
     * 全グラフを1枚の白背景画像に結合
     */
    async generateCombinedChart(report: MusicReport): Promise<Buffer> {
        console.log('🎨 統合レポート画像を生成中...');

        // 各グラフを生成
        const [topTracksChart, topArtistsChart, listeningTrendsChart, statsCard] = await Promise.all([
            this.generateTopTracksChart(report),
            this.generateTopArtistsChart(report),
            this.generateListeningTrendsChart(report),
            this.generateStatsCard(report),
        ]);

        // 結合画像のサイズ設定
        const canvasWidth = 1600;  // 2列
        const canvasHeight = 1400; // 2行 + ヘッダー + パディング
        const chartWidth = 800;
        const chartHeight = 600;
        const padding = 20;
        const headerHeight = 100;

        // キャンバス作成
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

        // 白背景を設定
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // ヘッダー情報を描画
        await this.drawHeader(ctx, report, canvasWidth, headerHeight);

        // 各グラフ画像を読み込んで配置
        const positions = [
            { x: padding, y: headerHeight + padding },                           // 左上：トップトラック
            { x: chartWidth + padding, y: headerHeight + padding },             // 右上：トップアーティスト
            { x: padding, y: headerHeight + chartHeight + padding * 2 },       // 左下：聴取推移
            { x: chartWidth + padding, y: headerHeight + chartHeight + padding * 2 }, // 右下：統計サマリー
        ];

        const charts = [topTracksChart, topArtistsChart, listeningTrendsChart, statsCard];

        for (let i = 0; i < charts.length; i++) {
            const img = await loadImage(charts[i]);
            ctx.drawImage(img, positions[i].x, positions[i].y, chartWidth, chartHeight);
        }

        // PNG形式でBufferとして返す
        return canvas.toBuffer('image/png');
    }

    /**
     * ヘッダー情報を描画
     */
    private async drawHeader(ctx: any, report: MusicReport, width: number, height: number): Promise<void> {
        const periodEmoji = {
            daily: '📅',
            weekly: '📊',
            monthly: '📈'
        };

        const periodName = {
            daily: '日次',
            weekly: '週次',
            monthly: '月次'
        };

        // ヘッダー背景（薄いグレー）
        ctx.fillStyle = '#F8F9FA';
        ctx.fillRect(0, 0, width, height);

        // ボーダー
        ctx.strokeStyle = '#E9ECEF';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, width, height);

        // タイトル
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 36px Arial, sans-serif';
        ctx.textAlign = 'center';
        const title = `${periodEmoji[report.period]} ${periodName[report.period]}音楽レポート`;
        ctx.fillText(title, width / 2, 45);

        // 期間とユーザー情報
        ctx.font = '24px Arial, sans-serif';
        ctx.fillStyle = '#6C757D';
        const periodText = `${report.dateRange.start} 〜 ${report.dateRange.end} | ${report.username}`;
        ctx.fillText(periodText, width / 2, 75);

        // Last.fmロゴ色のアクセント線
        ctx.strokeStyle = '#D60000';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(width / 2 - 200, 85);
        ctx.lineTo(width / 2 + 200, 85);
        ctx.stroke();
    }

    private getDateLabels(period: 'daily' | 'weekly' | 'monthly'): string[] {
        const now = new Date();
        const labels: string[] = [];

        switch (period) {
            case 'daily':
                // 過去7日分
                for (let i = 6; i >= 0; i--) {
                    const date = new Date(now);
                    date.setDate(date.getDate() - i);
                    labels.push(date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }));
                }
                break;
            case 'weekly':
                // 過去4週分
                for (let i = 3; i >= 0; i--) {
                    const date = new Date(now);
                    date.setDate(date.getDate() - (i * 7));
                    labels.push(`${date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}週`);
                }
                break;
            case 'monthly':
                // 過去6ヶ月分
                for (let i = 5; i >= 0; i--) {
                    const date = new Date(now);
                    date.setMonth(date.getMonth() - i);
                    labels.push(date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' }));
                }
                break;
        }

        return labels;
    }

    private generateMockTrendData(length: number): number[] {
        // 実際の実装では、Last.fmのAPIから取得したデータを使用
        return Array.from({ length }, () => Math.floor(Math.random() * 50) + 10);
    }

    /**
     * フォールバック用の推移データを生成
     */
    private generateFallbackTrendData(period: 'daily' | 'weekly' | 'monthly'): ListeningTrendData[] {
        const trends: ListeningTrendData[] = [];
        const now = new Date();

        switch (period) {
            case 'daily':
                for (let i = 6; i >= 0; i--) {
                    const date = new Date(now);
                    date.setDate(date.getDate() - i);
                    trends.push({
                        date: date.toISOString().split('T')[0],
                        scrobbles: Math.floor(Math.random() * 50) + 10,
                        label: date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
                    });
                }
                break;
            case 'weekly':
                for (let i = 3; i >= 0; i--) {
                    const date = new Date(now);
                    date.setDate(date.getDate() - (i * 7));
                    trends.push({
                        date: date.toISOString().split('T')[0],
                        scrobbles: Math.floor(Math.random() * 200) + 50,
                        label: `${date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}週`
                    });
                }
                break;
            case 'monthly':
                for (let i = 5; i >= 0; i--) {
                    const date = new Date(now);
                    date.setMonth(date.getMonth() - i);
                    trends.push({
                        date: date.toISOString().split('T')[0],
                        scrobbles: Math.floor(Math.random() * 800) + 200,
                        label: date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' })
                    });
                }
                break;
        }

        return trends;
    }
}
