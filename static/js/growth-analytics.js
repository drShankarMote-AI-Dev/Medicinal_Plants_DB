// Monthly and Yearly Growth Chart Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Initialize monthly growth chart
    const monthlyGrowthCtx = document.getElementById('monthlyGrowthChart').getContext('2d');
    const monthlyGrowthChart = new Chart(monthlyGrowthCtx, {
        type: 'bar',
        data: {
            labels: ['Plants', 'Users'],
            datasets: [
                {
                    label: 'Current Month',
                    data: [0, 0],
                    backgroundColor: '#2e7d32'
                },
                {
                    label: 'Previous Month',
                    data: [0, 0],
                    backgroundColor: '#81c784'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Monthly Growth Comparison'
                },
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Additions'
                    }
                }
            }
        }
    });

    // Initialize yearly growth chart
    const yearlyGrowthCtx = document.getElementById('yearlyGrowthChart').getContext('2d');
    const yearlyGrowthChart = new Chart(yearlyGrowthCtx, {
        type: 'bar',
        data: {
            labels: ['Plants', 'Users'],
            datasets: [
                {
                    label: 'Current Year',
                    data: [0, 0],
                    backgroundColor: '#2e7d32'
                },
                {
                    label: 'Previous Year',
                    data: [0, 0],
                    backgroundColor: '#81c784'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Yearly Growth Comparison'
                },
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Additions'
                    }
                }
            }
        }
    });

    // Function to update growth charts
    async function updateGrowthCharts() {
        try {
            const response = await fetch('/api/admin/growth-analytics');
            const data = await response.json();

            if (data.comparativeGrowth) {
                // Update monthly growth chart
                monthlyGrowthChart.data.datasets[0].data = [
                    data.comparativeGrowth.monthly.plants.current,
                    data.comparativeGrowth.monthly.users.current
                ];
                monthlyGrowthChart.data.datasets[1].data = [
                    data.comparativeGrowth.monthly.plants.previous,
                    data.comparativeGrowth.monthly.users.previous
                ];
                monthlyGrowthChart.update();

                // Update yearly growth chart
                yearlyGrowthChart.data.datasets[0].data = [
                    data.comparativeGrowth.yearly.plants.current,
                    data.comparativeGrowth.yearly.users.current
                ];
                yearlyGrowthChart.data.datasets[1].data = [
                    data.comparativeGrowth.yearly.plants.previous,
                    data.comparativeGrowth.yearly.users.previous
                ];
                yearlyGrowthChart.update();

                // Update growth percentage displays
                updateGrowthPercentages(data.comparativeGrowth);
            }
        } catch (error) {
            console.error('Error updating growth charts:', error);
        }
    }

    function updateGrowthPercentages(data) {
        // Calculate and display month-over-month growth percentages
        const plantsMonthlyGrowth = calculateGrowthPercentage(
            data.monthly.plants.current,
            data.monthly.plants.previous
        );
        const usersMonthlyGrowth = calculateGrowthPercentage(
            data.monthly.users.current,
            data.monthly.users.previous
        );

        // Calculate and display year-over-year growth percentages
        const plantsYearlyGrowth = calculateGrowthPercentage(
            data.yearly.plants.current,
            data.yearly.plants.previous
        );
        const usersYearlyGrowth = calculateGrowthPercentage(
            data.yearly.users.current,
            data.yearly.users.previous
        );

        // Update DOM elements
        updateGrowthElement('plantsMonthlyGrowth', plantsMonthlyGrowth);
        updateGrowthElement('usersMonthlyGrowth', usersMonthlyGrowth);
        updateGrowthElement('plantsYearlyGrowth', plantsYearlyGrowth);
        updateGrowthElement('usersYearlyGrowth', usersYearlyGrowth);
    }

    function calculateGrowthPercentage(current, previous) {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    }

    function updateGrowthElement(elementId, percentage) {
        const element = document.getElementById(elementId);
        if (element) {
            const formattedPercentage = percentage.toFixed(1);
            const arrow = percentage >= 0 ? '↑' : '↓';
            const className = percentage >= 0 ? 'positive' : 'negative';
            element.innerHTML = `${arrow} ${Math.abs(formattedPercentage)}%`;
            element.className = `growth-indicator ${className}`;
        }
    }

    // Initialize charts
    updateGrowthCharts();

    // Update charts every minute
    setInterval(updateGrowthCharts, 60000);
});